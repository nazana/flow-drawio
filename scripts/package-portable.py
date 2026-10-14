"""Package a built app with a verified official Node runtime for offline use."""
import hashlib
import json
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE = "22.23.1"
TARGETS = ("win-x64", "darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64")


def package(target):
    if target not in TARGETS:
        raise ValueError(f"Choose one of: {', '.join(TARGETS)}")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    output = ROOT / "releases"
    output.mkdir(exist_ok=True)
    filename = f"node-v{NODE}-{target}.{'zip' if target.startswith('win') else 'tar.gz'}"
    base = f"https://nodejs.org/dist/v{NODE}/"
    checksums = urllib.request.urlopen(base + "SHASUMS256.txt", timeout=60).read().decode()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[1] == filename)
    with tempfile.TemporaryDirectory(prefix="flow-portable-") as temporary:
        temp = Path(temporary)
        archive = temp / filename
        urllib.request.urlretrieve(base + filename, archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
            raise ValueError("Node runtime checksum mismatch")
        name = f"flow-studio-{version}-{target}"
        app = temp / name
        app.mkdir()
        for directory in ("dist", "server"):
            shutil.copytree(ROOT / directory, app / directory)
        (app / "src").mkdir()
        shutil.copy2(ROOT / "src/model.ts", app / "src/model.ts")
        (app / "public").mkdir()
        shutil.copy2(ROOT / "public/flow-styles.js", app / "public/flow-styles.js")
        shutil.copy2(ROOT / "package.json", app / "package.json")
        shutil.copytree(ROOT / "node_modules/@xmldom/xmldom", app / "node_modules/@xmldom/xmldom")
        runtime = app / "runtime"
        runtime.mkdir()
        prefix = f"node-v{NODE}-{target}/"
        if target.startswith("win"):
            with zipfile.ZipFile(archive) as source:
                for member in ("node.exe", "LICENSE"):
                    (runtime / member).write_bytes(source.read(prefix + member))
            (app / "start.bat").write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nset HOST=127.0.0.1\r\nset FLOW_DB_PATH=.data/flow.sqlite\r\necho Open http://127.0.0.1:5180 in your browser. Keep this window open.\r\nruntime\\node.exe --experimental-strip-types server\\index.ts\r\npause\r\n')
        else:
            with tarfile.open(archive) as source:
                for member, destination in (("bin/node", "node"), ("LICENSE", "LICENSE")):
                    with source.extractfile(prefix + member) as stream:
                        (runtime / destination).write_bytes(stream.read())
            (runtime / "node").chmod(0o755)
            launcher = app / ("start.command" if target.startswith("darwin") else "start.sh")
            launcher.write_text('#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nexport HOST=127.0.0.1 FLOW_DB_PATH=.data/flow.sqlite\necho "Open http://127.0.0.1:5180 in your browser. Keep this window open."\nexec ./runtime/node --experimental-strip-types server/index.ts\n')
            launcher.chmod(0o755)
        shutil.copy2(ROOT / "docs/portable.md", app / "README.md")
        assert (app / "dist/index.html").is_file()
        assert (app / "dist/drawio/index.html").is_file()
        assert (app / "node_modules/@xmldom/xmldom/lib/index.js").is_file()
        assert not (app / ".data").exists()
        result = output / f"{name}.zip"
        with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as bundle:
            for file in app.rglob("*"):
                if file.is_file():
                    bundle.write(file, file.relative_to(temp))
        print(result, flush=True)


if __name__ == "__main__":
    for target in sys.argv[1:] or TARGETS:
        package(target)
