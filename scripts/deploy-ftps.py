import ftplib
import hashlib
import os
import ssl
import subprocess
import sys
import time
from pathlib import Path, PurePosixPath
from urllib.request import urlopen


def release_files():
    tracked = subprocess.check_output(["git", "ls-files", "-z", "--", "public"])
    files = {}
    for entry in tracked.decode("utf-8").split("\0"):
        if not entry:
            continue
        source = Path(entry)
        relative = PurePosixPath(entry).relative_to("public")
        if relative.parts[0] in {"api", "cms"} or relative.suffix.lower() == ".php":
            continue
        files[relative] = source

    # The PHP host serves the admin UI from /cpanel/ as well as /admin.html.
    files[PurePosixPath("cpanel/index.html")] = files[PurePosixPath("admin.html")]
    index = PurePosixPath("index.html")
    return sorted(files.items(), key=lambda item: (item[0] == index, item[0]))


def ensure_directory(ftp, directory):
    try:
        ftp.cwd(str(directory))
    except ftplib.error_perm as error:
        if not str(error).startswith("550"):
            raise
        ensure_directory(ftp, directory.parent)
        ftp.mkd(str(directory))
        ftp.cwd(str(directory))


def remote_digest(ftp, name):
    digest = hashlib.sha256()
    try:
        ftp.retrbinary(f"RETR {name}", digest.update)
    except ftplib.error_perm as error:
        if str(error).startswith("550"):
            return None
        raise
    return digest.hexdigest()


def publish(ftp, files, release_id):
    for relative, source in files:
        directory = PurePosixPath("/") / relative.parent
        ensure_directory(ftp, directory)
        with source.open("rb") as data:
            digest = hashlib.file_digest(data, "sha256").hexdigest()
        try:
            remote_size = ftp.size(relative.name)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
            remote_size = None
        if remote_size == source.stat().st_size and remote_digest(ftp, relative.name) == digest:
            continue

        temporary = f".{relative.name}.{release_id}.upload"
        with source.open("rb") as data:
            ftp.storbinary(f"STOR {temporary}", data)
        if remote_digest(ftp, temporary) != digest:
            raise RuntimeError(f"Uploaded file failed verification: {relative}")
        ftp.rename(temporary, relative.name)
        print(f"Published {relative}", flush=True)


def main():
    files = release_files()
    if sys.argv[1:] == ["--list"]:
        for relative, source in files:
            if not source.is_file() or source.is_symlink():
                raise RuntimeError(f"Expected a tracked regular file: {source}")
            print(relative)
        return

    required = ("FTPS_HOST", "FTPS_USER", "FTPS_PASSWORD")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise SystemExit("Missing GitHub production secrets: " + ", ".join(missing))

    host, user, password = (os.environ[name] for name in required)
    release_id = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    for attempt in range(3):
        try:
            with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30) as ftp:
                ftp.connect(host, 21)
                ftp.login(user, password)
                ftp.prot_p()
                ftp.voidcmd("TYPE I")
                publish(ftp, files, release_id)
            break
        except (OSError, EOFError, ftplib.error_temp):
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))

    with urlopen("https://andreiko.me/", timeout=30) as response:
        if response.status != 200:
            raise RuntimeError("Production homepage did not return HTTP 200")


if __name__ == "__main__":
    main()
