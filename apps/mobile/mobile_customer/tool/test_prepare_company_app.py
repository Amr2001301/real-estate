"""Tests for tool/prepare_company_app.py — run: python3 tool/test_prepare_company_app.py"""
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_company_app as tool  # noqa: E402


def png(width: int, height: int) -> bytes:
    """A PNG header with the given size — enough for the size check."""
    return tool.PNG_SIGNATURE + struct.pack('>I', 13) + b'IHDR' + struct.pack('>II', width, height) + b'\x08\x06\x00\x00\x00'


class PrepareCompanyAppTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / 'assets' / 'brand').mkdir(parents=True)
        (self.dir / 'android' / 'app' / 'src' / 'main' / 'res' / 'values').mkdir(parents=True)
        self.icon = self.dir / 'icon.png'
        self.icon.write_bytes(png(1024, 1024))

    def tearDown(self):
        self.tmp.cleanup()

    def config(self, **app):
        base = {
            'appNameAr': 'بيوت أكمي',
            'appNameEn': "Acme's \"Homes\" & Co",
            'packageId': 'com.acme.homes',
            'iconUrl': str(self.icon),
            'splashUrl': None,
        }
        base.update(app)
        return {'company': {'slug': 'acme', 'primaryColor': '#123456'}, 'app': base}

    def load(self, data):
        path = self.dir / 'config.json'
        path.write_text(json.dumps(data), encoding='utf-8')
        return tool.load_config(path)

    def test_writes_package_id_names_icons_and_lock(self):
        result = tool.prepare(self.load(self.config()), self.dir)
        self.assertEqual(result['packageId'], 'com.acme.homes')
        self.assertIn('applicationId=com.acme.homes', (self.dir / 'android' / 'company.properties').read_text())
        res = self.dir / 'android' / 'app' / 'src' / 'main' / 'res'
        self.assertIn('>بيوت أكمي<', (res / 'values-ar' / 'strings.xml').read_text(encoding='utf-8'))
        # Escaped for XML and for Android's own ' and " rules.
        self.assertIn(r'Acme\'s \"Homes\" &amp; Co', (res / 'values' / 'strings.xml').read_text())
        self.assertEqual((self.dir / 'assets' / 'brand' / 'app_icon.png').read_bytes(), self.icon.read_bytes())
        # No splash given: the icon is used.
        self.assertEqual((self.dir / 'assets' / 'brand' / 'flutter_native_splash.png').read_bytes(), self.icon.read_bytes())
        defines = json.loads((self.dir / 'build' / 'company' / 'dart_defines.json').read_text(encoding='utf-8'))
        self.assertEqual(defines, {'COMPANY_SLUG': 'acme', 'COMPANY_NAME': 'بيوت أكمي'})
        self.assertIn('adaptive_icon_background: "#123456"', (self.dir / 'build' / 'company' / 'flutter_launcher_icons.yaml').read_text())

    def test_splash_image_is_used_when_given(self):
        splash = self.dir / 'splash.png'
        splash.write_bytes(png(1242, 2688))
        tool.prepare(self.load(self.config(splashUrl=str(splash))), self.dir)
        self.assertEqual((self.dir / 'assets' / 'brand' / 'flutter_native_splash.png').read_bytes(), splash.read_bytes())

    def test_brand_colour_falls_back_when_missing_or_malformed(self):
        data = self.config()
        data['company']['primaryColor'] = 'red'
        self.assertEqual(tool.prepare(self.load(data), self.dir)['background'], tool.DEFAULT_BACKGROUND)

    def test_refuses_what_cannot_make_a_store_app(self):
        with self.assertRaisesRegex(tool.ConfigError, 'no app of its own'):
            self.load({'company': {'slug': 'acme'}, 'app': None})
        for pkg in ('com.realestate.customer.mobile_customer', 'Com.Acme', 'single', 'com.acme.app\n'):
            with self.assertRaisesRegex(tool.ConfigError, 'package id'):
                self.load(self.config(packageId=pkg))
        for slug in ('', 'ac me', 'acme\nEVIL=1', 'acme\n'):
            data = self.config()
            data['company']['slug'] = slug
            with self.assertRaisesRegex(tool.ConfigError, 'slug'):
                self.load(data)
        with self.assertRaisesRegex(tool.ConfigError, 'icon'):
            self.load(self.config(iconUrl=None))
        with self.assertRaisesRegex(tool.ConfigError, 'appNameEn'):
            self.load(self.config(appNameEn='  '))

    def test_icon_must_be_a_1024_png(self):
        self.icon.write_bytes(png(512, 512))
        with self.assertRaisesRegex(tool.ConfigError, '1024'):
            tool.prepare(self.load(self.config()), self.dir)
        self.icon.write_bytes(b'GIF89a not a png')
        with self.assertRaisesRegex(tool.ConfigError, 'PNG'):
            tool.prepare(self.load(self.config()), self.dir)

    def test_leading_at_sign_is_not_a_resource_reference(self):
        self.assertEqual(tool.android_string('@home'), r'\@home')

    def test_main_reports_a_config_error_with_exit_code_2(self):
        path = self.dir / 'config.json'
        path.write_text(json.dumps({'company': {'slug': 'acme'}, 'app': None}), encoding='utf-8')
        self.assertEqual(tool.main(['--config', str(path)]), 2)


if __name__ == '__main__':
    unittest.main()
