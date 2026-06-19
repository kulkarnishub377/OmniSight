#!/usr/bin/env python3
"""Seed AMIF demo data via HTTP API.

Usage:
  python scripts/seed_demo.py --base-url http://localhost:8000
"""
import argparse
import json
import urllib.parse
import urllib.request


def request(url, method='GET', headers=None, data=None):
    body = None
    if data is not None:
        body = data if isinstance(data, bytes) else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:8000')
    parser.add_argument('--email', default='admin@example.com')
    parser.add_argument('--password', default='admin123')
    args = parser.parse_args()

    login_body = urllib.parse.urlencode({'username': args.email, 'password': args.password}).encode('utf-8')
    token = request(f'{args.base_url}/api/auth/login', method='POST', headers={'Content-Type': 'application/x-www-form-urlencoded'}, data=login_body)['access_token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    result = request(f'{args.base_url}/api/demo/seed', method='POST', headers=headers, data={})
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
