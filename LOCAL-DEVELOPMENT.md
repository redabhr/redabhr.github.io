# Developpement local

Le site statique et le Worker se lancent dans deux processus distincts.

## Site

Depuis la racine :

```powershell
npm install
npm run dev
```

Ouvrir `http://localhost:8000`.

Le serveur local retire automatiquement l'endpoint Production de la page et
autorise le Worker local `http://localhost:8787/token`. Le fichier `index.html`
Production n'est jamais modifie.

## Worker video

Dans un second terminal :

```powershell
cd workers/video-token
npm install
npm run dev
```

Le fichier `workers/video-token/.dev.vars` doit contenir les identifiants Mux
Development locaux. Il est ignore par Git.

## WebStorm

Creer deux configurations **npm** :

1. `Site local` : package.json racine, script `dev`.
2. `Worker video local` : `workers/video-token/package.json`, script `dev`.

Les lancer ensemble avec une configuration **Compound** `Local portfolio`.
