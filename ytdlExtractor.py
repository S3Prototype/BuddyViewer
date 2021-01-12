# coding: utf-8
from __future__ import unicode_literals

import functools
import itertools
import operator
import re

from .common import InfoExtractor
from ..compat import (
    compat_HTTPError,
    compat_str,
    compat_urllib_request,
)
from .openload import PhantomJSwrapper
from ..utils import (
    determine_ext,
    ExtractorError,
    int_or_none,
    merge_dicts,
    NO_DEFAULT,
    orderedSet,
    remove_quotes,
    str_to_int,
    url_or_none,
)

def _download_webpage_handle(self, url_or_request,
        video_id, note=None, errnote=None, fatal=True, 
        encoding=None, data=None, headers={}, query={},
        expected_status=None):
        """
        Return a tuple (page content as string, URL handle).
        See _download_webpage docstring for arguments specification.
        """
        # Strip hashes from the URL (#1038)
        if isinstance(url_or_request, (compat_str, str)):
            url_or_request = url_or_request.partition('#')[0]

        urlh = self._request_webpage(url_or_request, video_id, note, errnote, fatal, data=data, headers=headers, query=query, expected_status=expected_status)
        if urlh is False:
            assert not fatal
            return False
        content = self._webpage_read_content(urlh, url_or_request, video_id, note, errnote, fatal, encoding=encoding)
        return (content, urlh)

def _download_webpage(
            self, url_or_request, video_id, note=None, errnote=None,
            fatal=True, tries=1, timeout=5, encoding=None, data=None,
            headers={}, query={}, expected_status=None):
        """
        Return the data of the page as a string.
        Arguments:
        !! Put the url in this value:
        url_or_request -- plain text URL as a string or
            a compat_urllib_request.Requestobject
        ?? Have to check in the actual pornhub version of this
        ?? method to see what they're passing as the video_id
        video_id -- Video/playlist/item identifier (string)
        * All of these should be left as their default values, except
        * fatal, which I think should be false so we don't get any
        * errors. Or we can just handle the error in JS when it bubles
        * up.
        Keyword arguments:
        note -- note printed before downloading (string)
        errnote -- note printed in case of an error (string)
        fatal -- flag denoting whether error should be considered fatal,
            i.e. whether it should cause ExtractionError to be raised,
            otherwise a warning will be reported and extraction continued
        tries -- number of tries
        timeout -- sleep interval between tries
        encoding -- encoding for a page content decoding, guessed automatically
            when not explicitly specified
        data -- POST data (bytes)
        headers -- HTTP headers (dict)
        query -- URL query (dict)
        expected_status -- allows to accept failed HTTP requests (non 2xx
            status code) by explicitly specifying a set of accepted status
            codes. Can be any of the following entities:
                - an integer type specifying an exact failed status code to
                  accept
                - a list or a tuple of integer types specifying a list of
                  failed status codes to accept
                - a callable accepting an actual failed status code and
                  returning True if it should be accepted
            Note that this argument does not affect success status codes (2xx)
            which are always accepted.
        """

        success = False
        try_count = 0
        while success is False:
            try:
                res = self._download_webpage_handle(
                    url_or_request, video_id, note, errnote, fatal,
                    encoding=encoding, data=data, headers=headers,
                    query=query, expected_status=expected_status)
                success = True
            except compat_http_client.IncompleteRead as e:
                try_count += 1
                if try_count >= tries:
                    raise e
                self._sleep(timeout, video_id)
        if res is False:
            return res
        else:
            content, _ = res
            return content

def dl(*args, **kwargs):
            # Super just lets you call methods from a parent class
            # The first argument is the class that's calling super.
            # This is a convention from Python 2.
            return super(PornHubBaseIE, self)._download_webpage_handle(*args, **kwargs)


class PornHubBaseIE(InfoExtractor):
    def _download_webpage_handle(self, *args, **kwargs):
        def dl(*args, **kwargs):
            # Super just lets you call methods from a parent class
            # The first argument is the class that's calling super.
            # This is a convention from Python 2.
            return super(PornHubBaseIE, self)._download_webpage_handle(*args, **kwargs)

        ret = dl(*args, **kwargs)

        if not ret:
            return ret

        webpage, urlh = ret

        if any(re.search(p, webpage) for p in (
                r'<body\b[^>]+\bonload=["\']go\(\)',
                r'document\.cookie\s*=\s*["\']RNKEY=',
                r'document\.location\.reload\(true\)')):
            url_or_request = args[0]
            url = (url_or_request.get_full_url()
                   if isinstance(url_or_request, compat_urllib_request.Request)
                   else url_or_request)
            phantom = PhantomJSwrapper(self, required_version='2.0')
            phantom.get(url, html=webpage)
            webpage, urlh = dl(*args, **kwargs)

        return webpage, urlh


class PornHubIE(PornHubBaseIE):
    IE_DESC = 'PornHub and Thumbzilla'
    _VALID_URL = r'''(?x)
                    https?://
                        (?:
                            (?:[^/]+\.)?(?P<host>pornhub(?:premium)?\.(?:com|net|org))/(?:(?:view_video\.php|video/show)\?viewkey=|embed/)|
                            (?:www\.)?thumbzilla\.com/video/
                        )
                        (?P<id>[\da-z]+)
                    '''
    @staticmethod
    def _extract_urls(webpage):
        return re.findall(
            r'<iframe[^>]+?src=["\'](?P<url>(?:https?:)?//(?:www\.)?pornhub\.(?:com|net|org)/embed/[\da-z]+)',
            webpage)

    def _extract_count(self, pattern, webpage, name):
        return str_to_int(self._search_regex(
            pattern, webpage, '%s count' % name, fatal=False))

    def _real_extract(self, url):
        mobj = re.match(self._VALID_URL, url)
        host = mobj.group('host') or 'pornhub.com'
        video_id = mobj.group('id')

        if 'premium' in host:
            if not self._downloader.params.get('cookiefile'):
                raise ExtractorError(
                    'PornHub Premium requires authentication.'
                    ' You may want to use --cookies.',
                    expected=True)

        self._set_cookie(host, 'age_verified', '1')

        def dl_webpage(platform):
            self._set_cookie(host, 'platform', platform)
                #Below substitutes the host and video_id into the string
                # for the _download_webpage function.
                # Downloading the webpage gets us the page with all the important
                # data in it for getting the url to the videos.
            return self._download_webpage(
                'https://www.%s/view_video.php?viewkey=%s' % (host, video_id),
                video_id, 'Downloading %s webpage' % platform)

        webpage = dl_webpage('pc')

        error_msg = self._html_search_regex(
            r'(?s)<div[^>]+class=(["\'])(?:(?!\1).)*\b(?:removed|userMessageSection)\b(?:(?!\1).)*\1[^>]*>(?P<error>.+?)</div>',
            webpage, 'error message', default=None, group='error')
        if error_msg:
            error_msg = re.sub(r'\s+', ' ', error_msg)
            raise ExtractorError(
                'PornHub said: %s' % error_msg,
                expected=True, video_id=video_id)

        # video_title from flashvars contains whitespace instead of non-ASCII (see
        # http://www.pornhub.com/view_video.php?viewkey=1331683002), not relying
        # on that anymore.
        title = self._html_search_meta(
            'twitter:title', webpage, default=None) or self._html_search_regex(
            (r'(?s)<h1[^>]+class=["\']title["\'][^>]*>(?P<title>.+?)</h1>',
             r'<div[^>]+data-video-title=(["\'])(?P<title>(?:(?!\1).)+)\1',
             r'shareTitle["\']\s*[=:]\s*(["\'])(?P<title>(?:(?!\1).)+)\1'),
            webpage, 'title', group='title')

        video_urls = []
        video_urls_set = set()
        subtitles = {}

        flashvars = self._parse_json(
            self._search_regex(
                r'var\s+flashvars_\d+\s*=\s*({.+?});', webpage, 'flashvars', default='{}'),
            video_id)
        if flashvars:
            subtitle_url = url_or_none(flashvars.get('closedCaptionsFile'))
            if subtitle_url:
                subtitles.setdefault('en', []).append({
                    'url': subtitle_url,
                    'ext': 'srt',
                })
            thumbnail = flashvars.get('image_url')
            duration = int_or_none(flashvars.get('video_duration'))
            media_definitions = flashvars.get('mediaDefinitions')
            if isinstance(media_definitions, list):
                for definition in media_definitions:
                    if not isinstance(definition, dict):
                        continue
                    video_url = definition.get('videoUrl')
                    if not video_url or not isinstance(video_url, compat_str):
                        continue
                    if video_url in video_urls_set:
                        continue
                    video_urls_set.add(video_url)
                    video_urls.append(
                        (video_url, int_or_none(definition.get('quality'))))
        else:
            thumbnail, duration = [None] * 2

        def extract_js_vars(webpage, pattern, default=NO_DEFAULT):
            assignments = self._search_regex(
                pattern, webpage, 'encoded url', default=default)
            if not assignments:
                return {}

            assignments = assignments.split(';')

            js_vars = {}

            def parse_js_value(inp):
                inp = re.sub(r'/\*(?:(?!\*/).)*?\*/', '', inp)
                if '+' in inp:
                    inps = inp.split('+')
                    return functools.reduce(
                        operator.concat, map(parse_js_value, inps))
                inp = inp.strip()
                if inp in js_vars:
                    return js_vars[inp]
                return remove_quotes(inp)

            for assn in assignments:
                assn = assn.strip()
                if not assn:
                    continue
                assn = re.sub(r'var\s+', '', assn)
                vname, value = assn.split('=', 1)
                js_vars[vname] = parse_js_value(value)
            return js_vars

        def add_video_url(video_url):
            v_url = url_or_none(video_url)
            if not v_url:
                return
            if v_url in video_urls_set:
                return
            video_urls.append((v_url, None))
            video_urls_set.add(v_url)

        def parse_quality_items(quality_items):
            q_items = self._parse_json(quality_items, video_id, fatal=False)
            if not isinstance(q_items, list):
                return
            for item in q_items:
                if isinstance(item, dict):
                    add_video_url(item.get('url'))

        if not video_urls:
            FORMAT_PREFIXES = ('media', 'quality', 'qualityItems')
            js_vars = extract_js_vars(
                webpage, r'(var\s+(?:%s)_.+)' % '|'.join(FORMAT_PREFIXES),
                default=None)
            if js_vars:
                for key, format_url in js_vars.items():
                    if key.startswith(FORMAT_PREFIXES[-1]):
                        parse_quality_items(format_url)
                    elif any(key.startswith(p) for p in FORMAT_PREFIXES[:2]):
                        add_video_url(format_url)
            if not video_urls and re.search(
                    r'<[^>]+\bid=["\']lockedPlayer', webpage):
                raise ExtractorError(
                    'Video %s is locked' % video_id, expected=True)

        if not video_urls:
            js_vars = extract_js_vars(
                dl_webpage('tv'), r'(var.+?mediastring.+?)</script>')
            add_video_url(js_vars['mediastring'])

        for mobj in re.finditer(
                r'<a[^>]+\bclass=["\']downloadBtn\b[^>]+\bhref=(["\'])(?P<url>(?:(?!\1).)+)\1',
                webpage):
            video_url = mobj.group('url')
            if video_url not in video_urls_set:
                video_urls.append((video_url, None))
                video_urls_set.add(video_url)

        upload_date = None
        formats = []
        for video_url, height in video_urls:
            if not upload_date:
                upload_date = self._search_regex(
                    r'/(\d{6}/\d{2})/', video_url, 'upload data', default=None)
                if upload_date:
                    upload_date = upload_date.replace('/', '')
            ext = determine_ext(video_url)
            if ext == 'mpd':
                formats.extend(self._extract_mpd_formats(
                    video_url, video_id, mpd_id='dash', fatal=False))
                continue
            elif ext == 'm3u8':
                formats.extend(self._extract_m3u8_formats(
                    video_url, video_id, 'mp4', entry_protocol='m3u8_native',
                    m3u8_id='hls', fatal=False))
                continue
            tbr = None
            mobj = re.search(r'(?P<height>\d+)[pP]?_(?P<tbr>\d+)[kK]', video_url)
            if mobj:
                if not height:
                    height = int(mobj.group('height'))
                tbr = int(mobj.group('tbr'))
            formats.append({
                'url': video_url,
                'format_id': '%dp' % height if height else None,
                'height': height,
                'tbr': tbr,
            })
        self._sort_formats(formats)

        video_uploader = self._html_search_regex(
            r'(?s)From:&nbsp;.+?<(?:a\b[^>]+\bhref=["\']/(?:(?:user|channel)s|model|pornstar)/|span\b[^>]+\bclass=["\']username)[^>]+>(.+?)<',
            webpage, 'uploader', default=None)

        def extract_vote_count(kind, name):
            return self._extract_count(
                (r'<span[^>]+\bclass="votes%s"[^>]*>([\d,\.]+)</span>' % kind,
                 r'<span[^>]+\bclass=["\']votes%s["\'][^>]*\bdata-rating=["\'](\d+)' % kind),
                webpage, name)

        view_count = self._extract_count(
            r'<span class="count">([\d,\.]+)</span> [Vv]iews', webpage, 'view')
        like_count = extract_vote_count('Up', 'like')
        dislike_count = extract_vote_count('Down', 'dislike')
        comment_count = self._extract_count(
            r'All Comments\s*<span>\(([\d,.]+)\)', webpage, 'comment')

        def extract_list(meta_key):
            div = self._search_regex(
                r'(?s)<div[^>]+\bclass=["\'].*?\b%sWrapper[^>]*>(.+?)</div>'
                % meta_key, webpage, meta_key, default=None)
            if div:
                return re.findall(r'<a[^>]+\bhref=[^>]+>([^<]+)', div)

        info = self._search_json_ld(webpage, video_id, default={})
        # description provided in JSON-LD is irrelevant
        info['description'] = None

        return merge_dicts({
            'id': video_id,
            'uploader': video_uploader,
            'upload_date': upload_date,
            'title': title,
            'thumbnail': thumbnail,
            'duration': duration,
            'view_count': view_count,
            'like_count': like_count,
            'dislike_count': dislike_count,
            'comment_count': comment_count,
            'formats': formats,
            'age_limit': 18,
            'tags': extract_list('tags'),
            'categories': extract_list('categories'),
            'subtitles': subtitles,
        }, info)


class PornHubPlaylistBaseIE(PornHubBaseIE):
    def _extract_entries(self, webpage, host):
        # Only process container div with main playlist content skipping
        # drop-down menu that uses similar pattern for videos (see
        # https://github.com/ytdl-org/youtube-dl/issues/11594).
        container = self._search_regex(
            r'(?s)(<div[^>]+class=["\']container.+)', webpage,
            'container', default=webpage)

        return [
            self.url_result(
                'http://www.%s/%s' % (host, video_url),
                PornHubIE.ie_key(), video_title=title)
            for video_url, title in orderedSet(re.findall(
                r'href="/?(view_video\.php\?.*\bviewkey=[\da-z]+[^"]*)"[^>]*\s+title="([^"]+)"',
                container))
        ]

    def _real_extract(self, url):
        mobj = re.match(self._VALID_URL, url)
        host = mobj.group('host')
        playlist_id = mobj.group('id')

        webpage = self._download_webpage(url, playlist_id)

        entries = self._extract_entries(webpage, host)

        playlist = self._parse_json(
            self._search_regex(
                r'(?:playlistObject|PLAYLIST_VIEW)\s*=\s*({.+?});', webpage,
                'playlist', default='{}'),
            playlist_id, fatal=False)
        title = playlist.get('title') or self._search_regex(
            r'>Videos\s+in\s+(.+?)\s+[Pp]laylist<', webpage, 'title', fatal=False)

        return self.playlist_result(
            entries, playlist_id, title, playlist.get('description'))


class PornHubUserIE(PornHubPlaylistBaseIE):
    _VALID_URL = r'(?P<url>https?://(?:[^/]+\.)?(?P<host>pornhub(?:premium)?\.(?:com|net|org))/(?:(?:user|channel)s|model|pornstar)/(?P<id>[^/?#&]+))(?:[?#&]|/(?!videos)|$)'
    _TESTS = [{
        'url': 'https://www.pornhub.com/model/zoe_ph',
        'playlist_mincount': 118,
    }, {
        'url': 'https://www.pornhub.com/pornstar/liz-vicious',
        'info_dict': {
            'id': 'liz-vicious',
        },
        'playlist_mincount': 118,
    }, {
        'url': 'https://www.pornhub.com/users/russianveet69',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/channels/povd',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/model/zoe_ph?abc=1',
        'only_matching': True,
    }]

    def _real_extract(self, url):
        mobj = re.match(self._VALID_URL, url)
        user_id = mobj.group('id')
        return self.url_result(
            '%s/videos' % mobj.group('url'), ie=PornHubPagedVideoListIE.ie_key(),
            video_id=user_id)


class PornHubPagedPlaylistBaseIE(PornHubPlaylistBaseIE):
    @staticmethod
    def _has_more(webpage):
        return re.search(
            r'''(?x)
                <li[^>]+\bclass=["\']page_next|
                <link[^>]+\brel=["\']next|
                <button[^>]+\bid=["\']moreDataBtn
            ''', webpage) is not None

    def _real_extract(self, url):
        mobj = re.match(self._VALID_URL, url)
        host = mobj.group('host')
        item_id = mobj.group('id')

        page = int_or_none(self._search_regex(
            r'\bpage=(\d+)', url, 'page', default=None))

        entries = []
        for page_num in (page, ) if page is not None else itertools.count(1):
            try:
                webpage = self._download_webpage(
                    url, item_id, 'Downloading page %d' % page_num,
                    query={'page': page_num})
            except ExtractorError as e:
                if isinstance(e.cause, compat_HTTPError) and e.cause.code == 404:
                    break
                raise
            page_entries = self._extract_entries(webpage, host)
            if not page_entries:
                break
            entries.extend(page_entries)
            if not self._has_more(webpage):
                break

        return self.playlist_result(orderedSet(entries), item_id)


class PornHubPagedVideoListIE(PornHubPagedPlaylistBaseIE):
    _VALID_URL = r'https?://(?:[^/]+\.)?(?P<host>pornhub(?:premium)?\.(?:com|net|org))/(?P<id>(?:[^/]+/)*[^/?#&]+)'
    _TESTS = [{
        'url': 'https://www.pornhub.com/model/zoe_ph/videos',
        'only_matching': True,
    }, {
        'url': 'http://www.pornhub.com/users/rushandlia/videos',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/pornstar/jenny-blighe/videos',
        'info_dict': {
            'id': 'pornstar/jenny-blighe/videos',
        },
        'playlist_mincount': 149,
    }, {
        'url': 'https://www.pornhub.com/pornstar/jenny-blighe/videos?page=3',
        'info_dict': {
            'id': 'pornstar/jenny-blighe/videos',
        },
        'playlist_mincount': 40,
    }, {
        # default sorting as Top Rated Videos
        'url': 'https://www.pornhub.com/channels/povd/videos',
        'info_dict': {
            'id': 'channels/povd/videos',
        },
        'playlist_mincount': 293,
    }, {
        # Top Rated Videos
        'url': 'https://www.pornhub.com/channels/povd/videos?o=ra',
        'only_matching': True,
    }, {
        # Most Recent Videos
        'url': 'https://www.pornhub.com/channels/povd/videos?o=da',
        'only_matching': True,
    }, {
        # Most Viewed Videos
        'url': 'https://www.pornhub.com/channels/povd/videos?o=vi',
        'only_matching': True,
    }, {
        'url': 'http://www.pornhub.com/users/zoe_ph/videos/public',
        'only_matching': True,
    }, {
        # Most Viewed Videos
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos?o=mv',
        'only_matching': True,
    }, {
        # Top Rated Videos
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos?o=tr',
        'only_matching': True,
    }, {
        # Longest Videos
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos?o=lg',
        'only_matching': True,
    }, {
        # Newest Videos
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos?o=cm',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos/paid',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/pornstar/liz-vicious/videos/fanonly',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/video',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/video?page=3',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/video/search?search=123',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/categories/teen',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/categories/teen?page=3',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/hd',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/hd?page=3',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/described-video',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/described-video?page=2',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/video/incategories/60fps-1/hd-porn',
        'only_matching': True,
    }, {
        'url': 'https://www.pornhub.com/playlist/44121572',
        'info_dict': {
            'id': 'playlist/44121572',
        },
        'playlist_mincount': 132,
    }, {
        'url': 'https://www.pornhub.com/playlist/4667351',
        'only_matching': True,
    }, {
        'url': 'https://de.pornhub.com/playlist/4667351',
        'only_matching': True,
    }]

    @classmethod
    def suitable(cls, url):
        return (False
                if PornHubIE.suitable(url) or PornHubUserIE.suitable(url) or PornHubUserVideosUploadIE.suitable(url)
                else super(PornHubPagedVideoListIE, cls).suitable(url))


class PornHubUserVideosUploadIE(PornHubPagedPlaylistBaseIE):
    _VALID_URL = r'(?P<url>https?://(?:[^/]+\.)?(?P<host>pornhub(?:premium)?\.(?:com|net|org))/(?:(?:user|channel)s|model|pornstar)/(?P<id>[^/]+)/videos/upload)'
    _TESTS = [{
        'url': 'https://www.pornhub.com/pornstar/jenny-blighe/videos/upload',
        'info_dict': {
            'id': 'jenny-blighe',
        },
        'playlist_mincount': 129,
    }, {
        'url': 'https://www.pornhub.com/model/zoe_ph/videos/upload',
        'only_matching': True,
    }]

#     © 2021 GitHub, Inc.
#     Terms
#     Privacy
#     Security
#     Status
#     Help

#     Contact GitHub
#     Pricing
#     API
#     Training
#     Blog
#     About

