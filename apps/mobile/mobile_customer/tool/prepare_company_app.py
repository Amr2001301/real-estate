#!/usr/bin/env python3
"""Prepare the customer app to be built as one company's own store app (MA2).

Input: the company's app settings as the platform owner keeps them — the
response of GET /v1/super-admin/companies/:id/mobile-app — saved to a file.

    python3 tool/prepare_company_app.py --config company.json

Then, from apps/mobile/mobile_customer:

    dart run flutter_launcher_icons -f build/company/flutter_launcher_icons.yaml
    dart run flutter_native_splash:create --path=build/company/flutter_native_splash.yaml
    flutter build appbundle --release -t lib/main_prod.dart \
        --dart-define-from-file=build/company/dart_defines.json

What it changes (in the working copy — run it on a CI checkout, not on a
branch you commit from):
  - android/company.properties          the applicationId (untracked)
  - android/.../values{,-ar}/strings.xml the name under the icon (EN / AR)
  - assets/brand/app_icon.png           the company's icon
  - assets/brand/flutter_native_splash.png  its splash image (the icon when unset)
  - build/company/*                     icon/splash generator configs and the
                                        dart-defines that lock the app to the company

Android only for now; the iOS bundle id and display name come with the build
workflow.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

APP_DIR = Path(__file__).resolve().parent.parent
PACKAGE_ID = re.compile(r'^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
SHARED_IDS = {'com.realestate.customer.mobile_customer', 'com.realestate.staff.mobile_staff'}
HEX_COLOR = re.compile(r'^#[0-9A-Fa-f]{6}$')
DEFAULT_BACKGROUND = '#0B1726'
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
MAX_DOWNLOAD = 5 * 1024 * 1024


class ConfigError(Exception):
    """The settings cannot make a store app; the message says what to fix."""


def load_config(path: Path) -> dict:
    data = json.loads(path.read_text(encoding='utf-8'))
    company, app = data.get('company') or {}, data.get('app')
    if not app:
        raise ConfigError('This company has no app of its own — set it up on its page in the super-admin dashboard.')
    slug = company.get('slug') or ''
    if not slug:
        raise ConfigError('The company has no slug.')
    pkg = app.get('packageId') or ''
    if not PACKAGE_ID.match(pkg) or pkg in SHARED_IDS:
        raise ConfigError(f'Invalid package id: {pkg!r}')
    for key in ('appNameAr', 'appNameEn'):
        if not (app.get(key) or '').strip():
            raise ConfigError(f'{key} is empty.')
    if not app.get('iconUrl'):
        raise ConfigError('Upload the app icon (1024×1024 PNG) before building.')
    return data


def android_string(value: str) -> str:
    """A value for <string>: XML-escaped, with Android's own escapes for ' and "."""
    out = value.strip().replace('\\', '\\\\')
    out = escape(out).replace("'", "\\'").replace('"', '\\"')
    # A leading @ or ? would be read as a resource reference.
    return '\\' + out if out[:1] in ('@', '?') else out


def strings_xml(name: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- Written by tool/prepare_company_app.py for this company build. -->\n'
        '<resources>\n'
        f'    <string name="app_name">{android_string(name)}</string>\n'
        '</resources>\n'
    )


def fetch(url: str) -> bytes:
    """The bytes at an http(s) URL or a local path (tests, manual runs)."""
    if re.match(r'^https?://', url):
        with urllib.request.urlopen(url, timeout=30) as res:  # noqa: S310 — the platform's own storage
            data = res.read(MAX_DOWNLOAD + 1)
    else:
        data = Path(url.removeprefix('file://')).read_bytes()
    if len(data) > MAX_DOWNLOAD:
        raise ConfigError(f'{url} is larger than {MAX_DOWNLOAD} bytes.')
    return data


def png_size(data: bytes) -> tuple[int, int]:
    if not data.startswith(PNG_SIGNATURE) or data[12:16] != b'IHDR':
        raise ConfigError('Not a PNG image.')
    return struct.unpack('>II', data[16:24])


def icons_yaml(background: str) -> str:
    return (
        'flutter_launcher_icons:\n'
        '  android: true\n'
        '  ios: true\n'
        '  image_path: "assets/brand/app_icon.png"\n'
        '  min_sdk_android: 21\n'
        f'  adaptive_icon_background: "{background}"\n'
        '  adaptive_icon_foreground: "assets/brand/app_icon.png"\n'
        '  remove_alpha_ios: true\n'
        '  web:\n'
        '    generate: false\n'
    )


def splash_yaml(background: str) -> str:
    return (
        'flutter_native_splash:\n'
        f'  color: "{background}"\n'
        '  image: assets/brand/flutter_native_splash.png\n'
        '  android_12:\n'
        f'    color: "{background}"\n'
        '    image: assets/brand/app_icon.png\n'
        f'    icon_background_color: "{background}"\n'
        '  android: true\n'
        '  ios: true\n'
        '  web: false\n'
    )


def prepare(config: dict, app_dir: Path = APP_DIR) -> dict:
    company, app = config['company'], config['app']
    background = company.get('primaryColor') or ''
    if not HEX_COLOR.match(background):
        background = DEFAULT_BACKGROUND

    icon = fetch(app['iconUrl'])
    width, height = png_size(icon)
    if (width, height) != (1024, 1024):
        raise ConfigError(f'The icon must be 1024×1024 (it is {width}×{height}).')
    splash = fetch(app['splashUrl']) if app.get('splashUrl') else icon
    png_size(splash)

    brand = app_dir / 'assets' / 'brand'
    (brand / 'app_icon.png').write_bytes(icon)
    (brand / 'flutter_native_splash.png').write_bytes(splash)

    android = app_dir / 'android'
    (android / 'company.properties').write_text(
        '# Written by tool/prepare_company_app.py — untracked.\n'
        f'applicationId={app["packageId"]}\n',
        encoding='utf-8',
    )
    res = android / 'app' / 'src' / 'main' / 'res'
    (res / 'values').mkdir(parents=True, exist_ok=True)
    (res / 'values-ar').mkdir(parents=True, exist_ok=True)
    (res / 'values' / 'strings.xml').write_text(strings_xml(app['appNameEn']), encoding='utf-8')
    (res / 'values-ar' / 'strings.xml').write_text(strings_xml(app['appNameAr']), encoding='utf-8')

    out = app_dir / 'build' / 'company'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'flutter_launcher_icons.yaml').write_text(icons_yaml(background), encoding='utf-8')
    (out / 'flutter_native_splash.yaml').write_text(splash_yaml(background), encoding='utf-8')
    defines = {'COMPANY_SLUG': company['slug'], 'COMPANY_NAME': app['appNameAr'].strip()}
    (out / 'dart_defines.json').write_text(json.dumps(defines, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'packageId': app['packageId'], 'slug': company['slug'], 'background': background}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True, type=Path, help='GET /v1/super-admin/companies/:id/mobile-app saved as JSON')
    args = parser.parse_args(argv)
    try:
        result = prepare(load_config(args.config))
    except ConfigError as err:
        print(f'error: {err}', file=sys.stderr)
        return 2
    print(f"Prepared {result['packageId']} for company {result['slug']}.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
