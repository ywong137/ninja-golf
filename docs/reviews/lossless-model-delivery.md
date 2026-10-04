# Lossless model delivery

The startup loader previously requested 160,201,740 bytes of character and motion GLBs before HTTP compression.
The build now creates gzip copies totaling 99,802,393 bytes, a reduction of 37.7%.
These eleven assets include six heroes, three enemy appearances, and two shared motion files.
The original GLBs remain available for browsers without `DecompressionStream`.
The development server continues to use the original loader.

The runtime accepts static gzip files or GLBs already decoded by HTTP `Content-Encoding`.
It checks the file signature before decompression to prevent double decoding.
Missing or corrupt compressed files report their URL and fail loading.
The asset list is shared between the runtime and build plugin.
The build compresses one file at a time to limit working memory.

All eleven generated files decompress to exactly the original bytes.
No geometry, material, texture, skeleton, or animation data changed.
Eight focused loader and club tests passed, alongside twelve existing asset and wardrobe tests.
The build passed.
Two muted production browser sessions verified every model hash and the JavaScript bundle.
Both sessions selected all six heroes and completed a real shot into combat.
One session used compressed URLs; the other disabled native decompression and used original URLs.
Neither session reported browser errors.

The local preview automatically applied HTTP decompression to gzip responses.
Unit tests also exercised static gzip, HTTP-decoded gzip, nested HTTP compression, corrupt files, and missing files.
Local loading times are not representative of public internet loading times.
This change reduces transfer size; it does not reduce the decoded model memory or rendering cost.

Run the production check after building:

```sh
node tools/verify-model-delivery.mjs http://localhost:5184 /tmp/ninja-model-delivery
node tools/verify-model-delivery.mjs http://localhost:5184 /tmp/ninja-model-fallback --fallback
```

Pass the public release URL to the same command to verify deployment.
The command compares downloaded content with the current local build and source assets.
Local evidence lives in the primary checkout under `artifacts/reviews/model-delivery/`.
