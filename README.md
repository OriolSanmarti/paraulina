# Paraulina

Joc de paraules en català, a l'estil del Wordle. Endevina la paraula de 5 lletres en 6 intents: les lletres es tornen verdes si són al lloc correcte i grogues si hi són però en un altre lloc.

**Juga-hi:** https://paraulina.web.app/

## Com funciona

- **Mapa de nivells**: avances per un camí de nivells, i la dificultat de les paraules puja a mesura que avances (fàcil, mitjà i difícil).
- **Nivells especials**: els nivells 10, 30, 50… són un **Penjat**, i els 20, 40, 60… un **Anagrama**.
- **Una partida al dia**: si encertes la Paraulina en 3 intents o menys, o superes un nivell especial, guanyes una partida extra.
- **Amics**: al mapa veus per on va la resta de jugadors (cal configurar Firebase, vegeu més avall).
- Els accents no compten (`nuvol` = `núvol`), però la **Ç** és una lletra pròpia.

## Fitxers

| Fitxer | Què hi ha |
|---|---|
| `index.html` | Estructura i disseny de la pàgina |
| `app.js` | Lògica del joc, el mapa i els amics |
| `paraules.js` | Paraules solució per nivell, paraules dels nivells especials i diccionari de paraules vàlides |
| `firebase-config.js` | Configuració de Firebase (a `null`, el joc funciona sense amics) |
| `firestore.rules` | Regles de seguretat de la base de dades |
| `firebase.json`, `.firebaserc` | Configuració per publicar a Firebase Hosting |

Per editar quines paraules surten a cada nivell, canvieu les llistes de `SOLUCIONS` i `ESPECIALS` a l'inici de `paraules.js`.

## Provar-lo en local

Obriu `index.html` al navegador. Afegint `?prova` a l'adreça (`index.html?prova`) no hi ha límit de partides diàries. Els amics només funcionen servint la carpeta des de `http://localhost` (per exemple amb `python -m http.server`), perquè la clau de Firebase està restringida a unes adreces concretes.

## Publicar

El joc s'allotja a Firebase Hosting (lloc `paraulina` del projecte `paraulina-def1c`). Per publicar els canvis, amb la [Firebase CLI](https://firebase.google.com/docs/cli) i la sessió iniciada (`firebase login`):

```
firebase deploy --only hosting,firestore:rules
```

L'antiga adreça de GitHub Pages (`oriolsanmarti.github.io/paraulina`) es publica des de la branca `redireccio` i porta a `paraulina.web.app`.

## Configurar la base de dades (Firebase)

1. A https://console.firebase.google.com creeu un projecte (el pla gratuït Spark n'hi ha prou).
2. **Authentication** → *Sign-in method* → activeu **Anònim** i **Google**.
3. **Firestore Database** → creeu la base de dades. Les regles es publiquen amb `firebase deploy --only firestore:rules`.
4. **Configuració del projecte** → *Les teves apps* → afegiu una app **web** i copieu l'objecte `firebaseConfig` a `firebase-config.js`.
5. A **Authentication** → *Settings* → *Authorized domains*, afegiu `paraulina.web.app`.
6. A la consola de Google Cloud, restringiu la clau de l'API a les adreces del joc.

## Crèdits

El diccionari de paraules vàlides surt del diccionari ortogràfic de [Softcatalà](https://github.com/Softcatala/catalan-dict-tools) (versió 3.0.9), amb llicència GPL-2.0+ / LGPL-2.1+.
