# AI Active Recall

AI Active Recall turns your notes into a self-test. Pick a folder, and the plugin reads your notes and writes a set of questions and answers into a new file inside that folder. Open that file to quiz yourself and reinforce what you've written.

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
