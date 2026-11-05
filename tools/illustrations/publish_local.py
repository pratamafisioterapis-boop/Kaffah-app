#!/usr/bin/env python3
"""Publish agent-reviewed local images using Supabase only, without an OpenAI client/key."""
import argparse,json
from pathlib import Path
from PIL import Image
from pipeline import Worker,digest,save

def main():
    p=argparse.ArgumentParser();p.add_argument('--env',required=True);p.add_argument('--manifest',required=True)
    args=p.parse_args();env={}
    for line in Path(args.env).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);env[k.strip()]=v.strip().strip('\"\'')
    worker=Worker.__new__(Worker)
    worker.url=env['SUPABASE_URL'].rstrip('/')
    key=env['SUPABASE_SERVICE_ROLE_KEY'];worker.headers={'apikey':key}
    if not key.startswith('sb_secret_'):worker.headers['Authorization']='Bearer '+key
    manifest_path=Path(args.manifest)
    manifest=json.loads(manifest_path.read_text())
    if manifest.get('reviewed_by')!='Codex visual review' or manifest.get('approved') is not True:
        raise RuntimeError('Manifest must have explicit agent visual approval')
    paths=[]
    for item in manifest['steps']:
        path=Path(item['path']);data=path.read_bytes()
        if digest(data)!=item['sha256']:raise RuntimeError('Approval hash mismatch')
        with Image.open(path) as image:
            image.load()
            if image.format!='JPEG' or max(image.size)<1024 or not 0<len(data)<=5242880:
                raise RuntimeError('Invalid JPEG dimensions or size')
        paths.append(path)
    if not 2<=len(paths)<=12:raise RuntimeError('Incomplete sequence')
    rows=worker.publish({'id':manifest['exercise_id']},paths)
    save(manifest_path.with_suffix('.published.json'),{'exercise_id':manifest['exercise_id'],'rows':rows,'verified':True})
    print(json.dumps({'exercise_id':manifest['exercise_id'],'published_steps':len(rows),'signed_downloads_verified':True}))

if __name__=='__main__':main()
