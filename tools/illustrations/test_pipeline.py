import hashlib, io, unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from PIL import Image
from pipeline import Worker

class PublicationTests(unittest.TestCase):
    def setup_worker(self):
        worker=Worker.__new__(Worker)
        worker.url='https://example.supabase.co'
        return worker

    def image(self,directory):
        path=Path(directory)/'step.jpg'
        Image.new('RGB',(1024,1024),'white').save(path)
        return path

    def test_conflicting_remote_bytes_never_overwritten_or_published(self):
        worker=self.setup_worker();calls=[]
        def request(path,**kwargs): calls.append((path,kwargs));return b'other image'
        worker.request=request
        with TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError,'refusing overwrite'):
                worker.publish({'id':'CX02'},[self.image(directory)])
        self.assertEqual(len(calls),1)
        self.assertNotIn('method',calls[0][1])

    def test_signed_url_mismatch_prevents_database_publication(self):
        worker=self.setup_worker();calls=[]
        with TemporaryDirectory() as directory:
            path=self.image(directory);data=path.read_bytes()
            def request(url,**kwargs):
                calls.append(url)
                if '/object/sign/' in url:return {'signedURL':'/object/sign/file?token=test'}
                return data
            worker.request=request
            with patch('urllib.request.urlopen') as download:
                download.return_value.__enter__.return_value.read.return_value=b'corrupt'
                with self.assertRaisesRegex(RuntimeError,'content mismatch'):
                    worker.publish({'id':'CX02'},[path])
        self.assertFalse(any('/rpc/' in p for p in calls))

    def test_identical_upload_resume_and_mapping_verification(self):
        worker=self.setup_worker();calls=[]
        with TemporaryDirectory() as directory:
            path=self.image(directory);data=path.read_bytes()
            def request(url,**kwargs):
                calls.append((url,kwargs))
                if '/object/sign/' in url:return {'signedURL':'/object/sign/file?token=test'}
                if '/rpc/' in url:return None
                if '/rest/v1/exercise_illustration_steps?' in url:return [{'storage_path':'CX02/step-01.jpg'}]
                return data
            worker.request=request
            with patch('urllib.request.urlopen') as download:
                download.return_value.__enter__.return_value.read.return_value=data
                rows=worker.publish({'id':'CX02'},[path])
            self.assertEqual(rows[0]['size_bytes'],len(data))
        self.assertEqual(sum('/rpc/' in p for p,_ in calls),1)
        self.assertFalse(any(k.get('method')=='POST' and '/object/exercise' in p for p,k in calls))

if __name__=='__main__':unittest.main()
