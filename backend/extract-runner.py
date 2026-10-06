"""Extract official runner archives into a new directory; reject escaping entries."""
import os, pathlib, stat, sys, tarfile, zipfile
archive, dest = sys.argv[1:]
root = pathlib.Path(dest).resolve()
root.mkdir(mode=0o700, parents=True, exist_ok=False)
def target(name):
    if '\\' in name or name.startswith('/') or any(p == '..' for p in pathlib.PurePosixPath(name).parts):
        raise ValueError('unsafe archive path')
    out = root.joinpath(name)
    if not out.resolve().is_relative_to(root):
        raise ValueError('escaping archive path')
    return out
links, count, total, seen = [], 0, 0, set()
def write(name, size, mode, stream=None, link=None, directory=False):
    global count, total
    count += 1
    total += size
    if count > 50000 or total > 8 * 1024**3 or size < 0:
        raise ValueError('archive too large')
    out = target(name)
    if str(out) in seen and not directory:
        raise ValueError('duplicate entry')
    seen.add(str(out))
    if link is not None:
        if os.path.isabs(link) or '\\' in link or not (out.parent / link).resolve().is_relative_to(root):
            raise ValueError('unsafe symbolic link')
        links.append((out, link))
    elif directory:
        out.mkdir(mode=0o700, parents=True, exist_ok=True)
    else:
        out.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with out.open('xb') as handle:
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        out.chmod(mode & 0o777 or 0o600)
if zipfile.is_zipfile(archive):
    with zipfile.ZipFile(archive) as data:
        for entry in data.infolist():
            mode = entry.external_attr >> 16
            if stat.S_ISLNK(mode):
                if entry.file_size > 4096:
                    raise ValueError('symbolic link too large')
                write(entry.filename, entry.file_size, mode, link=data.read(entry).decode())
            elif entry.is_dir():
                write(entry.filename, 0, mode, directory=True)
            else:
                with data.open(entry) as stream:
                    write(entry.filename, entry.file_size, mode, stream)
else:
    with tarfile.open(archive, 'r:gz') as data:
        for entry in data:
            if entry.issym():
                write(entry.name, 0, entry.mode, link=entry.linkname)
            elif entry.isdir():
                write(entry.name, 0, entry.mode, directory=True)
            elif entry.isfile():
                with data.extractfile(entry) as stream:
                    write(entry.name, entry.size, entry.mode, stream)
            else:
                raise ValueError('unsupported archive member')
# Create links only after regular files; never write through an archive symlink.
for out, link in links:
    out.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    out.symlink_to(link)
