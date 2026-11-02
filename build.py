# -*- coding: utf-8 -*-
"""Junta os módulos de src/ em um único index.html.

Uso:  python build.py          (gera index.html na pasta do projeto)
      python build.py --check  (só confere se o index.html está atualizado)

Ordem: src/_head.html + <script type="text/babel"> + src/NN-*.js(x) em ordem
numérica + </script> + src/_tail.html.
"""
import io, os, sys, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")

def read(name):
    with io.open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()

def build():
    modules = sorted(n for n in os.listdir(SRC) if re.match(r"^\d\d-.*\.(js|jsx)$", n))
    parts = [read("_head.html"), '<script type="text/babel" data-presets="react" data-type="module">\n']
    for n in modules:
        body = read(n).rstrip("\n") + "\n"
        parts.append("/* >>> src/" + n + " */\n" + body + "\n")
    parts.append("</script>\n")
    parts.append(read("_tail.html"))
    return "".join(parts), modules

if __name__ == "__main__":
    html, modules = build()
    target = os.path.join(ROOT, "index.html")
    if "--check" in sys.argv:
        cur = io.open(target, encoding="utf-8").read() if os.path.exists(target) else ""
        print("index.html está atualizado" if cur == html else "index.html está DESATUALIZADO (rode: python build.py)")
        sys.exit(0 if cur == html else 1)
    with io.open(target, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("index.html gerado: %d módulos, %d KB" % (len(modules), len(html.encode("utf-8")) // 1024))
