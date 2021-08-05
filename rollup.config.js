import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';

const extensions = ['.js', '.ts'];
const plugins = [
  commonjs(),
  nodeResolve({ extensions }),
  babel({ extensions, include: ['./src/**/*'] }),
  terser(),
];

export default {
  input: 'src/index.ts',
  output: [
    { dir: 'lib', name: 'index.js', format: 'umd' },
    { file: 'lib/index.cjs.js', format: 'cjs' },
    { file: 'lib/index.es.js', format: 'es' },
  ],
  plugins,
};