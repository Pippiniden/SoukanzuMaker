import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-serif-jp/400.css';
import '@fontsource/noto-serif-jp/700.css';
import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import '@fontsource/zen-maru-gothic/400.css';
import '@fontsource/zen-maru-gothic/700.css';
import '@fontsource/klee-one/400.css';
import '@fontsource/klee-one/600.css';
import '@fontsource/yusei-magic/400.css';
import '@fontsource/dela-gothic-one/400.css';
import '@fontsource/mochiy-pop-one/400.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
