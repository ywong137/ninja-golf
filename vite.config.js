import { defineConfig } from 'vite';
import {playbackMotionPlugin} from './tools/playback-motion.mjs';
export default defineConfig({ base: './', plugins:[playbackMotionPlugin()], build: { chunkSizeWarningLimit: 900 } });
