# Plan de sortie Mux

Ce document permet de remplacer Mux sans modifier l'experience utilisateur du site.

## A conserver

- Le master 4K original, stocke hors du depot public et sauvegarde sur au moins deux supports.
- La recette FFmpeg du crop portrait 3:4 (`npm run build:video-portrait`).
- Les parametres de qualite, framerate, absence d'audio et variantes ciblees.
- Les identifiants d'asset, restrictions et parametres de lecture dans un coffre de secrets.

## Remplacement HLS

1. Choisir un fournisseur compatible HLS adaptatif et URLs signees.
2. Importer le master paysage et le rendu portrait.
3. Reproduire les variantes 270p a 2160p et verifier le manifeste.
4. Implementer un endpoint de jeton remplacant le Worker Mux.
5. Conserver la validation d'origine, le rate limiting et l'expiration courte.
6. Remplacer uniquement l'URL de playback dans le Worker et les tests associes.
7. Tester poster, autoplay, pause/reprise, boucle, visibilite et fallback image.
8. Basculer progressivement, puis revoquer les identifiants Mux apres confirmation.

## Retour au local

En cas d'indisponibilite du fournisseur, conserver le poster comme experience de repli. Un rendu MP4/WebM local peut etre active uniquement apres verification du poids, du cache et de la consommation mobile.
