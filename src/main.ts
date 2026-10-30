import './styles.css';
import './site/site.css';
import { initAnalytics } from './analytics';
import { applyTheme } from './theme/theme';
import { initSite, inkHero } from './site/site';
import { showSiteOnly } from './ui/fallback';
import { webglSupport } from './quality';

applyTheme();
initSite();
initAnalytics();

/* Bootstrap: the scene (and three.js) load only where they can run. Without WebGL2, or
   with a software renderer (no GPU acceleration), the visitor goes straight to the site. The gate stays up while the scene chunk loads;
   a failed import surfaces on the enter button (see the error handler in index.html). */
const gl = webglSupport();
if (gl === 'gpu') void import('./app');
else { showSiteOnly(gl === 'none' ? 'no_webgl' : 'software_gl'); inkHero(); }
