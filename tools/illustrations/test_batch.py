import threading, unittest, json, os
from unittest.mock import patch
from pipeline import Worker
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from PIL import Image
from run_batch import BatchWorker

class ReviewInputTests(unittest.TestCase):
    def test_pose_review_excludes_master_and_identity_review_includes_it(self):
        with TemporaryDirectory() as directory:
            worker=BatchWorker.__new__(BatchWorker)
            worker.root=Path(directory)
            worker.args=SimpleNamespace(reference='/private/master.jpg',review_model='gpt-5.4',attempts=1)
            worker.plan_slots=threading.BoundedSemaphore(1)
            folder=worker.root/'EX01';folder.mkdir()
            image=folder/'v3-step-01-attempt-1.jpg'
            Image.new('RGB',(1024,1024),'white').save(image)
            calls=[]
            def review(text,images):
                calls.append(list(images))
                if len(calls)==1:
                    return dict(pass_=True,**{'pass':True,'pose_correct':True,'anatomy_correct':True,'single_pose':True,'no_text':True,'reasons':[]})
                return {'identity_consistent':True,'reasons':[]}
            worker.llm=review
            exercise={'id':'EX01','how_to':'Stand relaxed','caution':''}
            plan={'use_master_reference':True,'reference_role':'demonstrator','steps':[{}]}
            accepted=worker.image(exercise,plan,1,{'pose':'Neutral start'},[])
            self.assertEqual(accepted,image)
            self.assertEqual(calls[0],[image])
            self.assertEqual(calls[1],['/private/master.jpg',image])

class PaidApiPreferenceTests(unittest.TestCase):
    def test_disabled_paid_api_prevents_client_creation(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            env=root/'.env';env.write_text('SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=sb_secret_test\n')
            (root/'provider-config.json').write_text(json.dumps({'paid_openai_api_enabled':False}))
            with patch.dict(os.environ,{},clear=False),patch('pipeline.OpenAI') as client:
                with self.assertRaisesRegex(RuntimeError,'disabled by user'):
                    Worker(SimpleNamespace(env=str(env),output=str(root)))
                client.assert_not_called()

if __name__=='__main__':unittest.main()
