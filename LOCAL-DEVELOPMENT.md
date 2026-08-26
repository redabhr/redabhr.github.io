# Developpement local

Le site statique et le Worker peuvent etre lances ensemble avec une seule commande.

## Lancement unique

Depuis la racine :

```powershell
npm install
cd workers/video-token
npm install
cd ../..
npm run dev
```

Cette commande demarre le site sur `http://localhost:8000` et le Worker sur
`http://localhost:8787`. `Ctrl+C` arrete proprement les deux processus.

## Site

Depuis la racine :

```powershell
npm install
npm run dev:site
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

Pour activer Mux Data en local, definir la variable publique
`MUX_DATA_ENV_KEY` dans la configuration d'execution WebStorm (ou dans la
session PowerShell) avant `npm run dev`. Sans cette variable, le monitoring
reste desactive et la lecture video fonctionne normalement.

En production, ajouter `MUX_DATA_ENV_KEY` comme **Repository variable** dans
GitHub : `Settings > Secrets and variables > Actions > Variables`. La valeur
doit etre la `Environment Key` Mux Data Production, jamais un API Token ou une
cle privee.

## WebStorm

Creer deux configurations **npm** :

1. `Site local` : package.json racine, script `dev`.
2. `Worker video local` : `workers/video-token/package.json`, script `dev`.

Les lancer ensemble avec une configuration **Compound** `Local portfolio`.
