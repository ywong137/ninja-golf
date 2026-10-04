import { defineConfig } from 'vite';
import {playbackMotionPlugin} from './tools/playback-motion.mjs';
import {compressedModelsPlugin} from './tools/compressed-models.mjs';
export default defineConfig({ base: './', plugins:[playbackMotionPlugin(),compressedModelsPlugin()], build: { chunkSizeWarningLimit: 900 } });
