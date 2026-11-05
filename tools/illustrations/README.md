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

## Controlled full batch

`run_batch.py` extends the worker with per-exercise status/checkpoint files and six bounded parallel workers. Use the same --env, --reference, --image-cli and --output arguments plus --publish. An empty --ids (the default) queries every current exercise without video. --attempts defaults to three; each rejected image's concrete defects are included in the next prompt. --max-images caps calls per run. Each later stage is conditioned on the accepted first-stage image for consistency. Pregnancy and pediatric plans use suitable models, with the master reference optionally serving as the supervising therapist. Internal contractions are represented by correct supported positions, without inventing visible motion; written exercise instructions remain separate. Unresolved ambiguity is never counted as a published exercise.

The v3 run writes plan-v3.json, checkpoint-v3.json, status-v3.json per exercise, plus batch-report-v3.json. Resuming retains successful files and mappings. Full-batch generation follows explicit user authorization to continue beyond the pilot.

## Built-in image generation (no paid OpenAI API)

The active Clinara run now uses Codex's built-in imagegen tool. The agent generates and visually reviews each independent image in the chat, saves approved JPEGs and a hash-bound manifest, then runs `publish_local.py --env /private/.env.pipeline --manifest /path/to/agent-manifest.json`. This publishing command constructs only a Supabase transport and does not construct or call an OpenAI client. It needs no OpenAI API key. Supabase uploads, signed download checks and atomic mappings remain automatic.

`provider-config.json` in the output directory may set `paid_openai_api_enabled` to `false`. API workers then refuse to initialize, preserving the user's preference. Built-in generation is subject to the chat's available tools and usage limits; it is not an unattended API worker and cannot promise unlimited subscription capacity. A Plus subscription and API billing are separate. Never silently re-enable the paid API.
