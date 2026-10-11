# Paraulina

Joc de paraules en català, a l'estil del Wordle. Endevina la paraula de 5 lletres en 6 intents: les lletres es tornen verdes si són al lloc correcte i grogues si hi són però en un altre lloc.

**Juga-hi:** https://oriolsanmarti.github.io/paraulina/

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

Per editar quines paraules surten a cada nivell, canvieu les llistes de `SOLUCIONS` i `ESPECIALS` a l'inici de `paraules.js`.

## Provar-lo en local

Obriu `index.html` al navegador. Afegint `?prova` a l'adreça (`index.html?prova`) no hi ha límit de partides diàries.

## Configurar la base de dades (Firebase)

1. A https://console.firebase.google.com creeu un projecte (el pla gratuït Spark n'hi ha prou).
2. **Authentication** → *Sign-in method* → activeu **Anònim**.
3. **Firestore Database** → creeu la base de dades i, a la pestanya *Regles*, enganxeu el contingut de `firestore.rules` i publiqueu.
4. **Configuració del projecte** → *Les teves apps* → afegiu una app **web** i copieu l'objecte `firebaseConfig` a `firebase-config.js`.
5. A **Authentication** → *Settings* → *Authorized domains*, comproveu que hi ha `oriolsanmarti.github.io`.

## Crèdits

El diccionari de paraules vàlides surt del diccionari ortogràfic de [Softcatalà](https://github.com/Softcatala/catalan-dict-tools) (versió 3.0.9), amb llicència GPL-2.0+ / LGPL-2.1+.
