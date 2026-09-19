import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

type Word = {word: string; hl: boolean; newLine: boolean};

/** Splits "Is what|you're scrolling|[[actually true?]]" into words, remembering
 * which are highlighted ([[double brackets]]) and where lines break ("|"). */
function parse(text: string): Word[] {
  const words: Word[] = [];
  text.split('|').forEach((line, lineIndex) => {
    let first = true;
    line.split(/(\[\[.*?\]\])/).forEach((part) => {
      const hl = part.startsWith('[[');
      const clean = hl ? part.slice(2, -2) : part;
      clean
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          words.push({word, hl, newLine: lineIndex > 0 && first});
          first = false;
        });
    });
  });
  return words;
}

/** Text that rises into place one word at a time. Wrap words in [[double
 * brackets]] to colour them, and use "|" to force a line break. */
export const Words: React.FC<{
  text: string;
  start?: number;
  stagger?: number;
  highlightClass?: string;
}> = ({text, start = 0, stagger = 3, highlightClass = 'hl'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <>
      {parse(text).map(({word, hl, newLine}, i) => {
        const p = spring({frame: frame - start - i * stagger, fps, config: {damping: 200}, durationInFrames: 22});
        return (
          <React.Fragment key={i}>
            {newLine && <br />}
            <span
              className={hl ? highlightClass : undefined}
              style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}
            >
              {word}
            </span>{' '}
          </React.Fragment>
        );
      })}
    </>
  );
};
