import ftplib
import hashlib
import json
import os
import ssl
import subprocess
import sys
import tempfile
import time
from pathlib import Path, PurePosixPath
from urllib.parse import quote
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


def transfer(host, user, password, destination, *options, output=None):
    credentials = json.dumps(f"{user}:{password}", ensure_ascii=False)
    return subprocess.run(
        [
            "curl", "--disable", "--config", "-", "--ssl-reqd", "--silent",
            "--show-error", "--connect-timeout", "20", "--max-time", "90",
            *options,
            f"ftp://{host}/%2F{quote(destination.as_posix().lstrip('/'))}",
        ],
        input=f"user = {credentials}\n".encode("utf-8"),
        stdout=output,
    )


def remote_digest(host, user, password, path):
    with tempfile.TemporaryFile() as data:
        result = transfer(host, user, password, path, output=data)
        if result.returncode == 78:
            return None
        if result.returncode:
            raise OSError(f"FTPS read failed for {path} (curl exit {result.returncode})")
        data.seek(0)
        return hashlib.file_digest(data, "sha256").hexdigest()


def upload_verified(ftp, source, relative, release_id, host, user, password):
    directory = PurePosixPath("/") / relative.parent
    temporary = f".{relative.name}.{release_id}.upload"
    remote_temp = directory / temporary
    result = transfer(host, user, password, remote_temp, "--upload-file", str(source))
    if result.returncode:
        raise OSError(f"FTPS upload failed for {relative} (curl exit {result.returncode})")
    with source.open("rb") as data:
        digest = hashlib.file_digest(data, "sha256").hexdigest()
    if remote_digest(host, user, password, remote_temp) != digest:
        raise RuntimeError(f"Uploaded file failed verification: {relative}")
    ftp.rename(temporary, relative.name)
    print(f"Published {relative}", flush=True)


def add_slide_link_fields(content):
    # The legacy PHP CMS uses the published file as its validation template.
    changed = False
    for slide in content["hero"]["slides"]:
        if "caseUrl" not in slide:
            slide["caseUrl"] = ""
            changed = True
    return changed


def cms_content_bytes(content):
    data = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    data = data.replace("<", r"\u003c").replace("\u2028", r"\u2028").replace("\u2029", r"\u2029")
    return f"window.SITE_DEFAULTS={data};\n".encode("utf-8")


def publish_cms_content(ftp, relative, payload, expected_digest, release_id, host, user, password):
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp) / relative.name
        source.write_bytes(payload)
        if remote_digest(host, user, password, PurePosixPath("/") / relative) != expected_digest:
            print("CMS content changed during deployment; preserving the current publication", flush=True)
            return False
        upload_verified(ftp, source, relative, release_id, host, user, password)
    return True


def migrate_cms_slide_links(ftp, relative, release_id, host, user, password):
    remote_path = PurePosixPath("/") / relative
    with tempfile.TemporaryFile() as public_file:
        result = transfer(host, user, password, remote_path, output=public_file)
        if result.returncode:
            raise OSError(f"Could not read public CMS data (curl exit {result.returncode})")
        public_file.seek(0)
        current = public_file.read()

    prefix, equals, data = current.decode("utf-8").strip().partition("=")
    if not equals or prefix.strip() != "window.SITE_DEFAULTS":
        raise RuntimeError("Unexpected public CMS content format")
    content = json.loads(data.strip().removesuffix(";"))
    if not add_slide_link_fields(content):
        return

    digest = hashlib.sha256(current).hexdigest()
    if publish_cms_content(ftp, relative, cms_content_bytes(content), digest, release_id, host, user, password):
        print("Added slide link fields to the public CMS template", flush=True)


def restore_cms_content(ftp, relative, default_digest, release_id, host, user, password):
    # A matching stock file can be the result of an earlier deployment.
    # The PHP CMS records the published content independently of that file.
    published_path = PurePosixPath("/cms/published.json")
    with tempfile.TemporaryFile() as record:
        result = transfer(host, user, password, published_path, output=record)
        if result.returncode == 78:
            return
        if result.returncode:
            raise OSError(f"Could not read the CMS publication (curl exit {result.returncode})")
        record.seek(0)
        content = json.load(record).get("content")
    if not isinstance(content, dict) or not content:
        raise RuntimeError("The CMS publication is missing its content")

    add_slide_link_fields(content)
    payload = cms_content_bytes(content)
    if hashlib.sha256(payload).hexdigest() == default_digest:
        return

    if publish_cms_content(ftp, relative, payload, default_digest, release_id, host, user, password):
        print("Restored public content from the saved CMS publication", flush=True)


def publish(ftp, files, release_id, host, user, password):
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

        same_file = remote_size == source.stat().st_size and remote_digest(
            host, user, password, directory / relative.name,
        ) == digest
        if relative == PurePosixPath("content-defaults.js") and remote_size is not None:
            if same_file:
                restore_cms_content(ftp, relative, digest, release_id, host, user, password)
            else:
                migrate_cms_slide_links(ftp, relative, release_id, host, user, password)
            print("Preserved the public CMS content file", flush=True)
            continue
        if same_file:
            continue

        print(f"Uploading {relative}", flush=True)
        upload_verified(ftp, source, relative, release_id, host, user, password)


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
                publish(ftp, files, release_id, host, user, password)
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
