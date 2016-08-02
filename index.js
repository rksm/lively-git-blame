async function prevCommit(file, rev) {
  return normalizeRev(file, rev + "~1");
}

// await nextCommit("http://localhost:9001/node_modules/lively.morphic/rendering/renderer.js", "2820ac553655ee958cc4d9bc4634171e6cbe95ab")

async function nextCommit(file, dir, rev) {
  var opts = {dir};

  var {code, output} = await lively.shell.run(`git branch --contains ${rev}`, opts);
  if (code) throw new Error(output);

  var branch = output.trim().split("\n").find(ea => ea.startsWith("*")).replace(/^\*\s*/, ""),
      {code, output} = await lively.shell.run(`git rev-list --reverse --ancestry-path ${rev}..${branch} | head -1`, opts);
      show(`git rev-list --reverse --ancestry-path ${rev}..${branch} | head -1`)

  var nextRev = output.trim();
  return nextRev || branch || rev;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function normalizeRev(file, dir, rev) {
  var {code, output} = await lively.shell.run(`git rev-parse ${rev}`, {dir});
  if (code) throw new Error(code + "\n" + output);
  return output.trim();
}

export async function annotateRevIn(ed, file, dir, rev = "HEAD", row) {

  var {file: currentFile, dir: currentDir} = ed.state;
  if (!dir) dir = currentDir;
  if (!file) file = currentFile;

  if (!rev) {
    ed.showError(`No such revision ${rev}`);
    return;
  }

  var fullRev = await normalizeRev(file, dir, rev);
  if (code) {
    ed.showError(new Error(code + "\n" + output));
    return;
  }

  // var cmd = file && file !== currentFile ?
  //   `git blame -f ${fullRev} -- ${file}` :
  //   `git blame -f ${currentFile} ${fullRev}`
  var cmd = `git blame -f ${fullRev} -- ${file}`;
  var {code, output} = await lively.shell.run(cmd, {dir});
  if (code) {
    ed.showError(new Error(output));
    return;
  }

  ed.state = {...ed.state, dir, file, rev: fullRev, row};

  ed.textString = output;
  if (typeof row !== "undefined")
    ed.selectAndCenterLine(row);

  var win = ed.getWindow();
  if (win) {
    win.setTitle(`git blame – ${file} ${fullRev.slice(0,7)}`);
  }

  ed.focus();
}

export async function queryAnnotateRevIn(ed) {
  var {dir} = ed.state
  if (!dir) dir = lively.shell.cwd();
  var {file, rev} = revAndFileAtLine(ed);
  var rev = await $world.prompt("Jump to revision", {historyId: "git-blame-queryAnnotateRevIn", input: rev});
  if (!rev) return;
  var file = await $world.prompt("File", {historyId: "git-blame-queryAnnotateRevIn-file", input: file});
  if (!file) return;
  annotateRevIn(ed, file, dir, rev);
}

export async function revBack(ed) {
  if (!ed.state) return;
  var {rev} = ed.state;
  var row = ed.getSelection().getLineRange().start.row;
  return annotateRevIn(ed, null, null, `${rev}~1`, row);
}

export async function revFwd(ed) {
  if (!ed.state) return;
  var {file, dir, rev} = ed.state;
  var row = ed.getSelection().getLineRange().start.row;
  return annotateRevIn(ed, null, null, await nextCommit(file, dir, rev), row);
}

export function revAndFileAtLine(ed) {
  var line = ed.getLine(ed.getCursorPositionAce().row);
  var parts = line.split(/\s/);
  return {rev: parts[0], file: parts[1]};
}

export function revAtLine(ed) {
  var {rev}  = revAndFileAtLine(ed);
  return rev;
}

export async function showContentOfVersionAtLine(ed) {
  var {file, rev} = revAndFileAtLine(ed);
  var {dir} = ed.state;

  rev = await normalizeRev(file, dir, rev);
  var {code, output} = await lively.shell.run(`git show ${rev}:${file}`, {dir});
  if (code) {
    ed.showError(new Error(code));
    return;
  }
  $world.addCodeEditor({
    textMode: "text",
    title: `${rev}:${file}`,
    content: output,
    extent: lively.pt(600,800)
  }).getWindow().comeForward();
}


export async function showLogOfVersionAtLine(ed) {
  var {rev} = revAndFileAtLine(ed);
  var {dir, file} = ed.state;

  rev = await normalizeRev(file, dir, rev);

  var {code, output} = await lively.shell.run(`git log ${rev}~1...${rev} -p --follow -- ${file}`, {dir});
  if (code) {
    ed.showError(new Error(code + "\n" + output));
    return;
  }
  $world.addCodeEditor({
    textMode: "diff",
    title: `log ${rev}`,
    content: output,
    extent: lively.pt(600,800)
  }).getWindow().comeForward();

}

export async function showDiffOfVersionAtLine(ed, justForFile = true) {
  var {file, rev} = revAndFileAtLine(ed);
  var {file: realFile, dir} = ed.state;

  rev = await normalizeRev(realFile, dir, rev);
  if (justForFile) {
    var {code, output} = await lively.shell.run(`git diff ${rev}~1...${rev} -C ${file} ${realFile}`, {dir});
  } else {
    var {code, output} = await lively.shell.run(`git diff ${rev}~1...${rev}`, {dir});
  }

  if (code) {
    ed.showError(new Error(code));
    return;
  }

  $world.addCodeEditor({
    textMode: "diff",
    title: `diff ${rev} ${justForFile ? file : ""}`,
    content: output,
    extent: lively.pt(600,800)
  }).getWindow().comeForward();
}

export async function showDiffOfAllFilesOfVersionAtLine(ed) {
  return showDiffOfVersionAtLine(ed, false)
}
