import {handlebars} from 'hbs';

import commentTemplate from './comment';
import issueTemplate from './issue';
import reopenClosedTemplate from './reopenClosed';
import closeTemplate from './close';
//import issueFromMergeTemplate from './issueFromMerge';
//import titleChangeTemplate from './titleChange';

// Register a githubHost global helper to make links respect the GHE_HOST env var
handlebars.registerHelper('githubHost', () => process.env.GHE_HOST || 'github.com')

export const template = {
  comment: handlebars.compile(commentTemplate),
  issue: handlebars.compile(issueTemplate),
  reopenClosed: handlebars.compile(reopenClosedTemplate),
  close: handlebars.compile(closeTemplate),
  //issueFromMerge: handlebars.compile(issueFromMergeTemplate),
  //titleChange: handlebars.compile(titleChangeTemplate),
}