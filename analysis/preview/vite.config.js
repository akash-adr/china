import path from 'node:path';
const projectRoot = path.resolve(__dirname, '../..');
export default {
  root: __dirname,
  // Serve the real asset folder so the preview loads exactly what the site will.
  publicDir: path.join(projectRoot, 'public'),
  resolve: {
    alias: { '@': path.join(projectRoot, 'src') },
    dedupe: ['three'],
  },
  server: { fs: { allow: [projectRoot] } },
};
