import './styles.css';
import { showSiteOnly } from './ui/fallback';
import { webglAvailable } from './quality';

/* Bootstrap: the scene (and three.js) load only where they can run. Without WebGL2 the
   visitor goes straight to the site. The gate stays up while the scene chunk loads;
   a failed import surfaces on the enter button (see the error handler in index.html). */
if (webglAvailable()) void import('./app');
else showSiteOnly('no WebGL2');
