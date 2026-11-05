# Clinara illustration worker

Run with Python 3.9+ and pinned requirements.txt. Keep the environment file and master photo outside the repository. Never use VITE_ variables for backend credentials.

The worker queries current exercise/video/illustration data, plans poses, calls the bundled imagegen CLI with the master photo for every independent step, validates JPEG dimensions and size, and performs a separate model-assisted visual review. Only complete, passing exercises can be published. Automated visual review is not a guarantee of clinical accuracy; ambiguous/supervised movements remain in clinical review.

```sh
python tools/illustrations/pipeline.py \
  --env /absolute/private/.env.pipeline \
  --reference /absolute/reference.png \
  --image-cli /absolute/path/to/imagegen/scripts/image_gen.py \
  --output /absolute/path/to/results \
  --ids CX02,SH07,LB10 --max-images 12 --publish
```

The API key must allow image edits and Responses calls. Default image model is gpt-image-2; planning/review model is gpt-5.4. The CLI is provided by the Codex imagegen skill; pass its installed absolute path. Set --ids '' to consider all exercises, only after pilot quality and portal verification pass. Image calls are sequential with an explicit per-run cap. Re-run the same command to resume saved plans, images and hash-bound quality decisions. Review report.json and each generation log for errors. Partial Storage uploads are verified byte-for-byte and reused only if identical; conflicting files are never replaced. Existing metadata is skipped for review, never overwritten.

Apply the atomic_exercise_illustration_publication migration before --publish. Every Storage upload uses x-upsert:false. All files are verified through signed URLs before a single transactional RPC publishes step mappings and the first-image compatibility record. Files uploaded before a failure remain unreferenced and can be resumed; no patient data is changed. Retries use bounded exponential backoff for transient Storage failures; OpenAI SDK handles bounded API retries. A failure in one exercise does not restart others.

Reports and output paths must stay outside source control. Generated illustrations need a clinically appropriate demonstrator. The worker defers special populations or ambiguous activation exercises to review; it must not silently substitute the master adult male.
