# AI Active Recall

AI Active Recall generates open-ended self-testing questions from your notes - the single most effective study strategy for long-term retention, backed by decades of cognitive science research. Pick any folder, and the plugin turns your notes into a comprehensive quiz you can answer out loud or in your head, reinforcing everything you've written through active retrieval.

## Installation

1. Open Obsidian and go to **Settings > Community Plugins**.
2. Turn off Safe Mode if prompted.
3. Click **Browse** and search for **AI Active Recall**.
4. Click **Install**, then **Enable**.
5. Go to **Settings > AI Active Recall** to open Plugin Settings.
6. Paste your OpenAI API key into the API key field. If you don't have one, get it at [platform.openai.com](https://platform.openai.com).

## How to use

There are three ways to generate a self-test for a folder.

**Command palette**

Press `Cmd+P` (Mac) or `Ctrl+P` (Windows/Linux) to open the command palette. Type **Generate Self-Test for Current Folder** and press Enter. This runs on the folder that contains the note you currently have open.

**Context menu**

In the file explorer on the left, right-click any folder to open the context menu. Select **Generate Self-Test**. This lets you target any folder directly without opening a note first.

**Sidebar panel**

Open the command palette and run **Open Active Recall Panel**. The sidebar panel lists all folders in your vault that have notes. Each folder shows a Generate button - or a Regenerate button if a self-test already exists. Click it to run the self-test for that folder.

## Why self-testing and active recall work

Re-reading your notes feels productive but produces weak retention. Self-testing - actively retrieving information from memory rather than passively reviewing it - is what the research consistently points to as the strongest learning strategy.

Roediger and Karpicke (2006) showed that the testing effect strengthens long-term retention far more than restudying the same material. Students who practiced retrieval remembered significantly more after one week than those who re-read. Dunlosky et al. (2013) reviewed ten common learning techniques and rated practice testing the highest in utility; highlighting and re-reading ranked at the bottom. Karpicke and Blunt (2011) found that retrieval practice outperformed elaborative concept mapping for meaningful learning.

For a thorough and accessible walkthrough of the science behind these strategies, Andrew Huberman covers it well in his episode [Optimal Protocols for Studying & Learning](https://www.youtube.com/watch?v=ddq8JIMhz7c) on the [Huberman Lab podcast](https://www.youtube.com/@hubermanlab).

Each part of the self-test file is designed around this research. The concept map gives you a structural overview of the topics and relationships you are about to be tested on, so your thinking is oriented before retrieval begins. Questions are open-ended and ordered from simple to complex, building retrieval from foundational concepts upward. Hints situate you in the right context without revealing the answer - they preserve the retrieval effort that makes the practice effective. Reference answers let you verify your recall and trace back to original notes for deeper review.

## How is this different from other quiz plugins?

Other related plugins in the Obsidian ecosystem take a different approach: they generate questions but ask you to type full answers into text boxes, then submit them to an AI for grading and scoring. That loop - typing, waiting, reading feedback - adds friction and shifts the focus toward performance evaluation rather than the retrieval itself.

AI Active Recall works differently. Questions are meant to be answered out loud or in your head - zero typing, zero grading, pure retrieval practice. There are no scores, so the focus stays on recall rather than performance. The effort goes into the retrieval itself. The self-test also includes a concept map for orientation before you begin and questions ordered from simple to complex, with hints that cue without giving the answer away.
