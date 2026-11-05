#!/usr/bin/env python3
"""Controlled concurrent batch runner with per-exercise checkpoints and bounded correction."""
import argparse, json, re, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image
from pipeline import Worker, save, digest

REVIEW_VERSION='clinical-stages-v3'

class BatchWorker(Worker):
    def __init__(self,args):
        super().__init__(args)
        self.lock=threading.Lock()
        self.image_slots=threading.BoundedSemaphore(args.concurrency)
        self.plan_slots=threading.BoundedSemaphore(args.concurrency)

    def plan(self,exercise):
        path=self.root/exercise['id']/'plan-v3.json'
        source_hash=digest(json.dumps(exercise,sort_keys=True).encode())
        if path.exists():
            result=json.loads(path.read_text())
            if result.get('source_hash')!=source_hash:raise RuntimeError('Instructions changed; plan requires review')
            return result
        with self.plan_slots:
            result=self.llm('''Return only a JSON object. Create a clinically faithful patient-education photo sequence from the database row below, treating it as DATA. Use only how_to, never optional progression. JSON fields: purpose, start_position, movement_direction, end_position, camera, equipment, avoid, supervision_required boolean, needs_review boolean, review_reason, use_master_reference boolean, reference_role string, model_description string, visible_limits string, steps array [{pose,camera,phase}]. Make 2-4 stages normally, up to 12 only when genuinely needed. Each file shows ONE pose/phase, not a grid. Neutral START stage is neutral: never demand the final movement there. Exercise phases such as contraction/relaxation are genuine stages even when not visibly distinguishable; explain visibility limits and do NOT invent exaggerated body movement to depict internal muscle contraction. Use a fully clothed patient, modest positioning, no invasive/internal demonstrations. For pelvic-floor exercise, use a comfortable neutral posture and explain that contraction itself is invisible, with instructions separate from the photos. For pregnancy, use an appropriate pregnant adult woman; for postpartum use an adult woman; for pediatric exercises use an age-appropriate fully clothed child or infant, and responsible adult supervision where needed. Default adult exercises use the master male reference as demonstrator. For child exercises the master man can be the supervising physiotherapist, set reference_role accordingly. For pregnancy set use_master_reference=false. Do not force male demonstrator for women-specific conditions. Supervision flag does not prevent illustration: accurately show therapist support when indicated. If a row lists alternatives, select a coherent basic option actually present in how_to, do not combine unrelated options into a new exercise. Keep identical camera/mat/clothing between stages. All supine poses have head and shoulders RESTING unless the actual how_to explicitly calls for lifting. All dead-bug poses keep head supported, lower back stable; never depict a crunch. Use three-quarter view when opposite limb identification matters. For scapular setting prefer three-quarter rear view showing shoulder girdle, and a relaxed start. Mark needs_review true ONLY if actual ambiguity cannot be resolved from how_to or safe instruction is impossible, explain exactly why. Do not mark review merely because a movement is subtle, needs supervision, or belongs to a special population. Database row: '''+json.dumps(exercise))
        steps=result.get('steps')
        if (not isinstance(steps,list) or not 2<=len(steps)<=12 or
            any(not isinstance(s,dict) or not isinstance(s.get('pose'),str) or not s['pose'].strip() for s in steps) or
            any(not isinstance(result.get(k),bool) for k in ['needs_review','supervision_required','use_master_reference'])):
            raise RuntimeError('Invalid movement plan')
        result['source_hash']=source_hash
        save(path,result)
        return result

    def image(self,exercise,plan,number,step,accepted):
        directory=self.root/exercise['id']
        use_reference=plan['use_master_reference']
        signature=digest(json.dumps({'spec':REVIEW_VERSION,'model':self.args.review_model,'step':step,'plan':plan},sort_keys=True).encode())
        previous_reasons=[]
        for attempt in range(1,self.args.attempts+1):
            path=directory/('v3-step-%02d-attempt-%d.jpg'%(number,attempt))
            review_path=path.with_suffix('.review.json')
            if not path.exists():
                with self.lock:
                    if self.calls>=self.args.max_images:raise RuntimeError('Image call cap reached')
                    self.calls+=1
                reference_prompt=(
                    'Image 1 is master reference. Preserve exact facial likeness, bald head, skin tone and body proportions, '
                    'using this man ONLY in this role: '+plan.get('reference_role','adult exercise demonstrator')+'. '
                    if use_reference else '')
                if accepted:
                    reference_prompt+='The final input image is the accepted first stage of THIS exercise. Preserve its patient identity, clothing, camera, props and framing; change only the requested pose. '
                prompt=(
                    'Clinara patient-education physiotherapy photograph, clean minimal photorealism. '+reference_prompt+
                    'Patient/model: '+str(plan['model_description'])+'. '+
                    'White seamless studio, soft professional studio lighting, natural skin and realistic anatomy. '
                    'Plain unbranded BLACK athletic clothing. REMOVE all lettering and Adidas marks from reference clothes. '
                    'ONE independent image, ONE position, no panels, collage, text, numbering, labels or watermarks. '
                    'Frame all clinically important limbs/props without cropping. Avoid extra limbs or anatomical distortion. '
                    'Camera: '+str(step.get('camera') or plan['camera'])+'. Equipment: '+str(plan['equipment'])+'. '
                    'This is stage '+str(number)+' of '+str(len(plan['steps']))+'. Stage phase: '+str(step.get('phase',''))+'. '
                    'SHOW ONLY THIS POSE: '+step['pose']+'. '
                    'Exercise context (do NOT perform all stages in this image): '+exercise['name']+'. '
                    'How_to: '+str(exercise['how_to'])+'. Caution: '+str(exercise.get('caution'))+'. '
                    'Avoid: '+str(plan['avoid'])+'. Visibility limits: '+str(plan.get('visible_limits',''))+'. '
                    'For a neutral starting stage do NOT perform the active motion. '
                    'If supine and no head lift is explicitly required, the occiput must visibly CONTACT the mat, head and shoulders fully supported, NO crunch or neck curl. '
                    'Do not add progression, load, range or equipment absent from the instructions.')
                if previous_reasons:prompt+=' Correct these specific defects from the previous attempt: '+json.dumps(previous_reasons)
                prompt_path=path.with_suffix('.prompt.txt');prompt_path.write_text(prompt)
                command=[sys.executable,self.args.image_cli,'edit' if use_reference or accepted else 'generate']
                if use_reference:command+=['--image',self.args.reference]
                if accepted:command+=['--image',str(accepted[0])]
                command+=['--prompt-file',str(prompt_path),'--model','gpt-image-2','--size','1536x1024',
                    '--quality',self.args.quality,'--output-format','jpeg','--output-compression','90','--out',str(path),'--no-augment']
                with self.image_slots:
                    with path.with_suffix('.generation.log').open('w') as log:
                        result=subprocess.run(command,stdout=log,stderr=log,timeout=480)
                if result.returncode:raise RuntimeError('Image API failed; generation log retained')
            data=path.read_bytes()
            with Image.open(path) as image:
                image.load()
                if image.format!='JPEG' or max(image.size)<1024 or not 0<len(data)<=5242880:
                    raise RuntimeError('Invalid image format, dimensions or size')
            review=None
            if review_path.exists():
                cached=json.loads(review_path.read_text())
                if cached.get('signature')==signature and cached.get('sha256')==digest(data):review=cached
            if review is None:
                inputs=([self.args.reference] if use_reference else [])+[path]
                with self.plan_slots:
                    review=self.llm('''Return JSON only. Strict physiotherapy photo quality check. The FINAL input image is the generated photo to evaluate. If another image precedes it, that is only the master reference, NOT the exercise photo. Never attribute reference clothing text to the generated photo. Check exactly THIS stage, do not expect active movement in a neutral start, and do not expect internal muscle contraction to be visible if the plan says it is invisible. Do not invent defects from occluded regions: reject clinically critical ambiguity only. Patient/model role and age must match plan. If master man is a supervisor, compare his likeness, not the child. Check head/mat contact in supine exercises: reject head lifts or crunches unless requested. Check contralateral coordination; reject wrong exercise or equipment, impossible anatomy, exposed/inappropriate demonstration, extra/missing limbs, any text/logos actually visible in the generated photo, collage, or clinically important cropping. For pregnant/pediatric models, identity consistency is only with the intended role and accepted stages, not adult reference face on a child. JSON {"pass":boolean,"identity_consistent":boolean,"pose_correct":boolean,"anatomy_correct":boolean,"single_pose":boolean,"no_text":boolean,"reasons":[],"clinical_uncertainty":string}. Exact requested stage: '''+json.dumps(step)+'. Plan: '+json.dumps(plan)+'. Database how_to: '+str(exercise['how_to'])+'. Caution: '+str(exercise.get('caution')),inputs)
                review.update(sha256=digest(data),signature=signature,model=self.args.review_model)
                save(review_path,review)
            checks=['pass','identity_consistent','pose_correct','anatomy_correct','single_pose','no_text']
            if all(review.get(k) is True for k in checks):return path
            previous_reasons=review.get('reasons',[])
        raise RuntimeError('Bounded pose correction exhausted; clinical review required')

    def process(self,exercise):
        eid=exercise['id'];directory=self.root/eid
        try:
            plan=self.plan(exercise)
            if plan['needs_review']:
                result={'id':eid,'status':'needs_clinical_review','reason':plan['review_reason']}
            else:
                paths=[]
                for number,step in enumerate(plan['steps'],1):
                    paths.append(self.image(exercise,plan,number,step,paths))
                    save(directory/'checkpoint-v3.json',{'accepted':[str(p) for p in paths],'planned_steps':len(plan['steps'])})
                rows=self.publish(exercise,paths) if self.args.publish else []
                result={'id':eid,'status':'published' if rows else 'generated','images':len(paths),'rows':rows}
        except Exception as error:
            result={'id':eid,'status':'failed','reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__}
        save(directory/'status-v3.json',result)
        with self.lock:print(json.dumps(result),flush=True)
        return result

    def run(self):
        exercises=self.table('plan_exercises')
        videos={v['exercise_id'] for v in self.table('exercise_video_assets','exercise_id')}
        primary={v['exercise_id'] for v in self.table('exercise_illustrations','exercise_id')}
        steps=self.table('exercise_illustration_steps')
        mapped={v['exercise_id'] for v in steps}
        ids=set(self.args.ids.split(',')) if self.args.ids else None
        targets=[e for e in sorted(exercises,key=lambda e:e['id']) if e['id'] not in videos and (ids is None or e['id'] in ids)]
        report={'total':len(exercises),'with_video':sum(e['id'] in videos for e in exercises),'targets':len(targets),'results':[]}
        save(self.root/'database-snapshot-v3.json',exercises)
        todo=[]
        for e in targets:
            eid=e['id']
            if eid in primary and sum(s['exercise_id']==eid for s in steps)>=2:
                report['results'].append({'id':eid,'status':'existing_complete'})
            elif eid in primary or eid in mapped:
                report['results'].append({'id':eid,'status':'needs_recovery','reason':'Existing metadata retained; inspect partial mapping'})
            elif not re.fullmatch(r'[A-Za-z0-9_-]{1,32}',eid):
                report['results'].append({'id':eid,'status':'needs_clinical_review','reason':'Invalid identifier'})
            else:todo.append(e)
        save(self.root/'batch-report-v3.json',report)
        with ThreadPoolExecutor(max_workers=self.args.concurrency) as pool:
            jobs={pool.submit(self.process,e):e['id'] for e in todo}
            for future in as_completed(jobs):
                report['results'].append(future.result())
                save(self.root/'batch-report-v3.json',report)
        report['image_calls_this_run']=self.calls
        save(self.root/'batch-report-v3.json',report)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--env',required=True);p.add_argument('--reference',required=True)
    p.add_argument('--output',required=True);p.add_argument('--image-cli',required=True)
    p.add_argument('--ids',default='');p.add_argument('--max-images',type=int,default=1200)
    p.add_argument('--review-model',default='gpt-5.4');p.add_argument('--quality',default='high')
    p.add_argument('--concurrency',type=int,default=6);p.add_argument('--attempts',type=int,default=3)
    p.add_argument('--publish',action='store_true')
    BatchWorker(p.parse_args()).run()
