// The same two typefaces the app uses: Source Serif 4 for names and headlines,
// Public Sans for everything else.
import {loadFont as loadSerif} from '@remotion/google-fonts/SourceSerif4';
import {loadFont as loadSans} from '@remotion/google-fonts/PublicSans';

loadSerif('normal', {weights: ['400', '600', '700'], subsets: ['latin']});
loadSans('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']});

// Note: the font package registers the serif as "Source Serif Four", while the
// app's own CSS says "Source Serif 4". The stylesheets copied into
// src/app-css were renamed to match -- redo that if you copy them again.
