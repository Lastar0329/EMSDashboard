"""重新匯出資料並發布到 GitHub Pages（gh-pages 分支＝site/ 資料夾內容）。

用法：python publish.py            匯出 → commit → 推 main 與 gh-pages
      python publish.py --no-export 只推現有檔案
"""
import subprocess
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def run(*cmd, check=True):
    print("$", " ".join(cmd))
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    if r.stdout.strip():
        print(r.stdout.strip())
    if r.returncode and check:
        print(r.stderr.strip())
        sys.exit(r.returncode)
    return r


def main():
    if "--no-export" not in sys.argv:
        run(sys.executable, "export_data.py")
    run("git", "add", "-A")
    if run("git", "diff", "--cached", "--quiet", check=False).returncode:
        run("git", "commit", "-m", "Update dashboard data")
    run("git", "push", "origin", "main")
    run("git", "branch", "-D", "gh-pages", check=False)
    run("git", "subtree", "split", "--prefix", "site", "-b", "gh-pages")
    run("git", "push", "-f", "origin", "gh-pages")
    print("完成：https://lastar0329.github.io/EMSDashboard/")


if __name__ == "__main__":
    main()
