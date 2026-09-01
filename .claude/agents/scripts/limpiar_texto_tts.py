#!/usr/bin/env python3
"""Limpia texto extraído de PDF para síntesis de voz en español."""
import re, sys, unicodedata
from collections import Counter

MIN = "a-záéíóúüñ"
MAY = "A-ZÁÉÍÓÚÜÑ"
UMBRAL_ENCABEZADO = 0.30
UMBRAL_FRASE_LARGA = 40
NO_ES_NOTA = {"m2","m3","km2","cm2","cm3","h2o","co2","no2","mp3","mp4",
              "covid19","g20","u2","x1","a4","a3"}

ROMANO = re.compile(r"^\s*(?=[ivxlcdm])m*(?:c[md]|d?c{0,3})(?:x[lc]|l?x{0,3})"
                    r"(?:i[xv]|v?i{0,3})\s*$", re.I)
PAGINA = [
    re.compile(r"^\s*\d{1,4}\s*$"),
    re.compile(r"^\s*[—–\-\[\(\|]{1,2}\s*\d{1,4}\s*[—–\-\]\)\|]{1,2}\s*$"),
    re.compile(r"^\s*\|?\s*\d{1,4}\s*\|\s*$"),
    re.compile(r"^\s*p[áa]g(?:ina)?\.?\s*\d{1,4}\s*$", re.I),
]
CAPITULO = re.compile(r"^\s*(cap[ií]tulo|parte|libro|ep[ií]logo|pr[óo]logo|"
                      r"introducci[óo]n)\b", re.I)
ESCENA = re.compile(r"^\s*(\*\s*){3}\s*$|^\s*[·•§]{1,3}\s*$|^\s*_{3,}\s*$")
NOTA_BLOQUE = re.compile(r"^\s*\d{1,3}[\.\)]\s+\S")
INDICE = re.compile(r"\.{4,}\s*\d{1,4}\s*$")
PRELIM = re.compile(r"^\s*([ií]ndice|sumario|contenidos?|tabla de contenidos?|"
                    r"notas?|bibliograf[ií]a)\s*[\.:]?\s*$", re.I)

def clave(linea):
    s = unicodedata.normalize("NFD", linea.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[\d\W_]+", " ", s).strip()
    return s

def es_numero_pagina(linea, idx_pag, n_pags, borde):
    if any(p.match(linea) for p in PAGINA):
        return True
    if borde and ROMANO.match(linea) and idx_pag < max(8, n_pags // 20):
        return True
    return False

def limpiar(texto, informe):
    paginas = texto.split("\f")
    n = len(paginas)

    # --- 3.2 detectar maquetación repetida (antes de tocar nada) ---
    cuenta = Counter()
    for pag in paginas:
        lineas = [l for l in pag.splitlines() if l.strip()]
        for l in lineas[:2] + lineas[-2:]:
            k = clave(l)
            if 3 <= len(k) <= 70:      # una cornisa es corta; una frase no
                cuenta[k] += 1
    repetidos = {k for k, c in cuenta.items()
                 if n >= 8 and c > UMBRAL_ENCABEZADO * n}
    informe["encabezados"] = sorted(repetidos)

    fuera_pag = fuera_enc = 0
    limpias = []
    for i, pag in enumerate(paginas):
        lineas = pag.splitlines()
        idx_texto = [j for j, l in enumerate(lineas) if l.strip()]
        if not idx_texto:
            continue
        bordes = set(idx_texto[:2] + idx_texto[-2:])
        salida = []
        for j, l in enumerate(lineas):
            s = l.strip()
            if s and es_numero_pagina(s, i, n, j in bordes):   # 3.1
                fuera_pag += 1
                continue
            if j in bordes and clave(s) in repetidos:          # 3.2
                fuera_enc += 1
                continue
            salida.append(l)
        limpias.append("\n".join(salida))
    informe["num_pagina"] = fuera_pag
    informe["lineas_encabezado"] = fuera_enc
    t = "\n".join(limpias)

    # --- 3.4 palabras partidas (antes del reflujo) ---
    t, informe["guiones"] = re.subn(rf"([{MIN}])-\n[ \t]*([{MIN}])", r"\1\2", t)
    t = re.sub(rf"([{MIN}])-\n[ \t]*([{MAY}])", r"\1-\2", t)

    # --- 3.3 llamadas de nota ---
    def quita_nota(m):
        if (m.group(1) + m.group(2)).lower() in NO_ES_NOTA:
            return m.group(0)
        quita_nota.n += 1
        return m.group(1)
    quita_nota.n = 0
    t = re.sub(rf"([{MIN}{MAY}»\)\.,;:]|[{MIN}]{{2,}})(\d{{1,2}})(?=[\s\.,;:»\)\]”\"'…]|$)",
               lambda m: quita_nota(m), t)
    informe["notas"] = quita_nota.n

    # --- 3.5 reflujo, notas de bloque e índices ---
    parrafos, buffer, seguidas = [], "", 0
    for linea in t.split("\n"):
        s = linea.strip()
        if not s:
            if buffer: parrafos.append(buffer); buffer = ""
            seguidas = 0
            continue
        if INDICE.search(s):
            continue
        seguidas = seguidas + 1 if NOTA_BLOQUE.match(s) else 0
        if seguidas >= 3:
            continue
        corta = (not buffer
                 or buffer.rstrip().endswith((".", "?", "!", ":", "»", "…", '"'))
                 or s[0] in "—–«")
        if corta:
            if buffer: parrafos.append(buffer)
            buffer = s
        else:
            buffer += " " + s
    if buffer: parrafos.append(buffer)

    # --- 3.6 prosodia ---
    salida = []
    for p in parrafos:
        if ESCENA.match(p):
            salida.append("[[PAUSA:700]]"); continue
        if PRELIM.match(p):
            continue
        if CAPITULO.match(p) or (len(p) < 60 and p == p.upper() and any(c.isalpha() for c in p)):
            if not p.rstrip().endswith((".", ".", "?", "!")):
                p = p.rstrip() + "."
            salida += ["[[PAUSA:1200]]", p]
            continue
        salida.append(respirar(p))
    while salida and salida[0].startswith("[[PAUSA:"):
        salida.pop(0)
    informe["parrafos"] = len(salida)
    return "\n\n".join(salida)

def respirar(parrafo):
    """Una coma en frases de más de 40 palabras, ante conjunción sin coma cerca."""
    # Sin "y": aparece dentro de numerales ("treinta y un") y de enumeraciones,
    # donde la coma antes de "y" es además incorrecta en español.
    CONJ = r"(?:pero|aunque|mientras|porque|cuando|pues|sin embargo|no obstante)"
    fuera = []
    for frase in re.split(r"(?<=[\.\?\!…])\s+", parrafo):
        pal = frase.split()
        if len(pal) > UMBRAL_FRASE_LARGA:
            for m in re.finditer(rf"\s+{CONJ}\s+", frase):
                previo = frase[:m.start()].split()
                if len(previo) >= 12 and "," not in " ".join(previo[-12:]):
                    frase = frase[:m.start()] + "," + frase[m.start():]
                    break
        fuera.append(frase)
    return " ".join(fuera)

if __name__ == "__main__":
    crudo, destino = sys.argv[1], sys.argv[2]
    inf = {}
    texto = open(crudo, encoding="utf-8", errors="replace").read()
    limpio = limpiar(texto, inf)
    open(destino, "w", encoding="utf-8").write(limpio)
    print(f"páginas numeradas fuera : {inf['num_pagina']}")
    print(f"líneas de encabezado    : {inf['lineas_encabezado']}")
    print(f"encabezados detectados  : {inf['encabezados']}")
    print(f"llamadas de nota        : {inf['notas']}")
    print(f"palabras reunidas       : {inf['guiones']}")
    print(f"párrafos resultantes    : {inf['parrafos']}")
    print(f"caracteres              : {len(texto)} → {len(limpio)}")