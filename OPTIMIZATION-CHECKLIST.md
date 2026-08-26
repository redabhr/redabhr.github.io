# Checklist d'optimisation

Site : `https://reda.bouhaddar.com`

Ce document suit les optimisations techniques, UX, accessibilite et SEO de la page. Une tache ne doit etre cochee qu'apres implementation et verification.

## Prochaines actions

### P0 - A faire avant la cloture

- [ ] Ajouter un bouton pause/lecture discret pour l'animation de fond.
- [ ] Ajouter son nom accessible, son etat ARIA, son tooltip et la memorisation locale du choix.
- [ ] Tester Chrome, Edge, Firefox, Safari macOS/iOS et Chrome Android.
- [ ] Verifier la console, les erreurs reseau, le mode reduit, le reseau lent et le fallback sans JavaScript.

### P1 - Mesure et exploitation

- [ ] Decider explicitement entre Mux Data, une analytics sans cookies ou l'absence de mesure.
- [ ] Si Mux Data est active, integrer uniquement le SDK HLS.js avec une cle `ENV_KEY` publique et mesurer le QoE utile.
- [ ] Definir les seuils d'alerte Mux/Cloudflare et documenter la rotation des secrets.
- [ ] Verifier les cartes Open Graph/LinkedIn et les donnees structurees apres publication.

### P2 - Apres stabilisation

- [ ] Ajouter l'URL publique du calendrier et activer son bouton.
- [ ] Evaluer le trafic reel et les minutes Mux apres quelques jours.
- [ ] Documenter le plan de sortie vers un autre fournisseur HLS.

Dernier commit local non pousse au moment de cette revision : `d03f618 test(html): added static publication checks`.

## Etat initial

- [x] L'image `bg.jpg` reste visible pendant le chargement de la video.
- [x] La video apparait avec un fondu uniquement lorsqu'elle commence a jouer.
- [x] Le fallback image reste disponible si le Worker, Mux ou la lecture HLS ne repond pas.
- [x] `prefers-reduced-motion` desactive deja la video.
- [x] Le domaine canonique utilise `reda.bouhaddar.com`.
- [x] Le profil LinkedIn utilise `https://www.linkedin.com/in/rbouhaddar`.
- [x] Le statement affiche `Architecting Coherence. Enabling the Future.`.
- [x] L'expertise affiche `Strategy · Architecture · Transformation · Governance`.

### Mesures de reference

- [x] Poids local releve : environ 356 Ko hors services tiers.
- [x] `bg.jpg` releve : environ 267 Ko, 2560 x 1440.
- [x] Polices WOFF relevees : environ 71 Ko.
- [x] Mesurer la page deployee avec Lighthouse en mobile et desktop.
- [x] Mesurer le poids total et le nombre de requetes de la version Mux Production ; l'ancienne mesure YouTube est historique et non applicable.
- [x] Enregistrer les valeurs de reference LCP, CLS et TBT ; l'INP reel reste a mesurer avec des donnees terrain.

## P0 - Corrections prioritaires

### Analytics et confidentialite

- [x] Supprimer l'ancien script Universal Analytics `UA-67138007-1`.
- [x] Verifier qu'aucune requete vers `google-analytics.com` ne subsiste.
- [x] Decision : ne pas ajouter de mesure d'audience a ce stade.
- [x] Ne configurer aucun nouvel outil de mesure sans besoin explicite et strategie de consentement.
- [x] Decision : ne pas integrer Mux Data SDK a ce stade ; il mesure la qualite de lecture mais n'ameliore ni la diffusion, ni la boucle, ni la protection.
- [x] Conserver Mux Data comme outil de diagnostic QoE optionnel si des erreurs, lenteurs de demarrage ou rebufferings apparaissent en production.
- [x] Eviter le chargement de services tiers de tracking avant consentement : YouTube et les outils de mesure sont absents ; Mux est limite a la diffusion video necessaire.

### Accessibilite de la video

- [ ] Ajouter un bouton discret lecture/pause avec une icone explicite.
- [ ] Ajouter un libelle accessible, un etat ARIA et un tooltip au bouton.
- [x] Conserver le respect de `prefers-reduced-motion`.
- [ ] Memoriser localement le choix pause/lecture de l'utilisateur.
- [x] Verifier la navigation clavier et ajouter un focus visible aux liens de contact.

### Securite et liens obsoletes

- [x] Supprimer la redirection HTTPS vers HTTP et la configuration Apache obsolete de `.htaccess` (GitHub Pages gere HTTPS et les en-tetes de publication).
- [x] Verifier que le domaine public redirige HTTP vers HTTPS avec une reponse 301 GitHub Pages.
- [x] Supprimer le lien Skype devenu obsolete.
- [x] Tester le lien IRC et le supprimer, car il n'est plus pertinent pour le profil professionnel.
- [x] Verifier les liens externes et `mailto:` conserves.
- [x] Ajouter un acces distinct aux articles LinkedIn, en attendant la future page `/insights/`.
- [x] Afficher un emplacement calendrier grise, non cliquable et accessible en attendant son URL.
- [ ] Ajouter le lien de prise de rendez-vous des que son URL publique est disponible.
- [ ] Activer l'emplacement calendrier et le rendre navigable au clavier lorsque son URL sera disponible.
- [x] Aligner les quatre icones dans des emplacements fixes de 44 x 44 px.
- [x] Verifier visuellement leur alignement dans Chrome en 1440 x 900 et 375 x 812.
- [x] Remplacer les glyphes de police aux metriques variables par des SVG au `viewBox` carre.
- [x] Revalider l'alignement optique SVG en desktop et mobile apres le signalement `alignement.png`.
- [x] Ajuster individuellement l'echelle optique du mail et des articles sans modifier les zones de 44 x 44 px.
- [x] Agrandir legerement les quatre icones tout en conservant leur hierarchie visuelle.

## P1 - Image principale et LCP

- [x] Convertir `bg.jpg` en variantes AVIF, WebP et JPEG.
- [x] Generer les paysages 1280, 1920 et 2560 px et les portraits 3:4 centres 480, 720 et 1080 px.
- [x] Ajouter un script Sharp reproductible avec versions verrouillees pour regenerer les images.
- [x] Ajuster la qualite des encodages pour preserver les lignes fines : AVIF 62, WebP 84 et JPEG 86.
- [x] Regenerer le poster maitre depuis la premiere frame reellement decodee du MP4, puis reconstruire toutes les variantes responsive.
- [x] Comparer la frame 0 et le nouveau `bg.jpg` : erreur absolue moyenne de 0,85 niveau par canal, limitee a la compression JPEG.
- [x] Remplacer le simple background CSS par un element `<picture>` adapte a une image decorative.
- [x] Ajouter `srcset` et `sizes` pour eviter l'image 2560 px sur mobile portrait.
- [x] Definir `width` et `height` afin de stabiliser le ratio intrinsique.
- [x] Ajouter `fetchpriority="high"` a l'image principale.
- [x] Ne pas appliquer `loading="lazy"` a l'image principale.
- [x] Conserver une couleur de fond coherente si l'image ne charge pas.
- [x] Verifier que le cadrage reste correct sur mobile, tablette et desktop.
- [x] Corriger le crop 569 x 847 avec une source 3:4 qui conserve la meme geometrie `cover` que la video 16:9.
- [x] Verifier que le contraste du texte reste conforme sur toute l'image.
- [x] Ajouter un scrim directionnel natif et une vignette legere, communs a l'image et a la video.
- [x] Renforcer subtilement l'ombre du texte pour les cadrages ou le contenu quitte la zone sombre.

### Criteres de validation image

- [x] L'image principale s'affiche sans flash blanc ou noir avant la video.
- [x] Le mobile jusqu'au ratio 3:4 ne peut selectionner que les variantes portrait 480, 720 ou 1080 px.
- [x] L'image est decouverte directement dans le HTML.
- [x] Le LCP mesure est inferieur a 2,5 s dans le scenario mobile cible.
- [x] Le CLS reste inferieur a 0,1.

## P1 - Video Mux Production

### Decision d'architecture au 2026-08-23

- [x] Retenir comme cible initiale Mux Free avec HLS adaptatif et playback signe.
- [x] Retenir un Cloudflare Worker pour generer les JWT courts sans exposer la cle privee dans GitHub Pages ou le navigateur.
- [x] Conserver le poster responsive local comme affichage initial et fallback permanent.
- [x] Accepter que la solution gratuite protege les acces et le hotlinking, mais ne constitue pas un DRM et ne garantit pas l'impossibilite de capture.
- [x] Exclure le DRM Mux de la premiere implementation en raison de son cout fixe actuel de 100 USD par mois, hors licences.
- [x] Ne pas servir le master 4K depuis GitHub Pages.
- [x] Ne pas creer de playback ID public ni de rendu MP4 statique chez Mux.
- [x] Utiliser deux assets : paysage 16:9 et portrait centre 3:4, afin de ne pas transmettre les zones laterales ensuite coupees sur mobile.
- [x] Cibler 480p ou 720p sur mobile, 720p ou 1080p sur tablette et desktop, et ne laisser la 4K que pour un tres grand affichage avec une excellente connexion.

### Perimetre de protection retenu

- [x] Utiliser uniquement des URLs de lecture signees avec expiration courte, cible initiale de 60 secondes.
- [x] Restreindre la lecture a `reda.bouhaddar.com` en production.
- [x] Refuser les requetes sans referrer et les user-agents consideres a risque lorsque la compatibilite le permet.
- [x] Garder la cle privee Mux uniquement dans les secrets du Worker.
- [x] Ne jamais placer un secret, une cle de signature ou un token longue duree dans le depot ou le JavaScript public.
- [x] Ajouter une politique CSP limitee au Worker Production exact, a `*.mux.com` et aux ressources locales ; proteger le JSON-LD inline par hash SHA-256.
- [x] Definir le comportement volontaire en cas de referrer supprime par un navigateur de confidentialite : conserver le poster sans degrader la page.
- [x] Ajouter une limite de debit Cloudflare de 12 requetes par minute et une validation stricte de `Origin`, `Referer` et `User-Agent` sur l'endpoint de jeton.
- [x] Encoder `max_resolution` dans le JWT : 720p en portrait et 2160p en paysage, puis plafonner le lecteur a 1080p, 1440p ou 2160p selon le rendu et le reseau.
- [x] Verifier qu'un lien copie expire et qu'une lecture depuis un domaine non autorise echoue : HTTP 403 confirme apres 63 s, depuis un tiers et sans provenance.
- [x] Verifier qu'aucun original ou rendu MP4 direct n'est expose par la configuration Mux Production : `master_access` a `none` et `static_renditions` absent.

### Compatibilite cible

- [x] Cibler les versions recentes de Chrome, Edge, Firefox et Safari sur desktop et mobile.
- [x] Utiliser `hls.js` 1.7.0 avec MSE en priorite pour un ABR coherent, puis HLS natif comme fallback.
- [x] Conserver une amelioration progressive : sans HLS, JavaScript, autoplay ou acces au tiers, le poster reste utilisable.
- [x] Ne pas dependre de `navigator.connection`, car cette API n'est pas disponible dans tous les navigateurs ; l'utiliser seulement comme optimisation facultative.
- [x] Conserver `prefers-reduced-motion`, largement disponible, comme condition bloquant le chargement de la video.
- [x] Declencher la lecture par `play()` et gerer explicitement la promesse rejetee par les politiques d'autoplay.
- [ ] Tester Chrome et Edge sous Windows, Firefox, Safari macOS, Safari iOS et Chrome Android.
- [ ] Tester iOS en mode economie d'energie, un bloqueur de contenu et un navigateur sans MSE/HLS utilisable.
- [x] Configurer le player sans controle, titre, branding, focus clavier ni zone interactive ; revalidation finale a faire avec le flux Mux reel.

### Perennite et dependance fournisseur

- [x] Considerer Mux comme une dependance d'execution remplacable, et non comme le proprietaire unique du master.
- [x] Noter que Mux existe depuis 2015, se consacre a l'infrastructure video et publie un historique d'etat de ses services.
- [x] Noter que Cloudflare existe depuis 2009, est cote en bourse depuis 2019 et opere Workers sur son reseau mondial.
- [x] Ne pas assimiler ces indices de maturite a une garantie de duree equivalente a YouTube ou au maintien perpetuel d'une offre gratuite.
- [x] Identifier le principal risque comme commercial : modification des quotas, des prix ou des conditions du plan gratuit, plus que disparition technique a court terme.
- [ ] Conserver le master et les recettes de crop/encodage independamment de Mux.
- [x] Isoler les playback IDs et la signature Mux dans le Worker, et l'URL de jeton dans un seul attribut de configuration HTML.
- [x] Conserver le site entierement lisible avec le poster lors d'une panne, d'une configuration absente ou d'un retrait de Mux/Cloudflare.
- [ ] Documenter une procedure de sortie vers un autre fournisseur HLS ou vers des variantes MP4/WebM locales.
- [ ] Surveiller la page de statut Mux et les quotas Mux/Workers apres mise en production.

### Budget et seuils de la solution gratuite

- [x] Reference actuelle Mux Free : 10 assets et 100 000 minutes de diffusion mensuelles.
- [x] Reference actuelle Mux Smart Security : URLs signees et restrictions de domaine/referrer sans supplement DRM.
- [x] Reference actuelle Cloudflare Workers Free : 100 000 requetes quotidiennes et 10 ms CPU par invocation.
- [ ] Verifier ces conditions dans les comptes reels avant l'implementation, car les offres peuvent evoluer.
- [ ] Definir un seuil d'alerte a 70 % du quota mensuel Mux et du quota quotidien Worker.
- [ ] Eviter toute activation automatique d'une offre payante sans plafond ou alerte de facturation.

### Preparation du media

- [x] Recuperer le fichier source `media/enterprise_architect_background_loop.mp4` sans l'ajouter a Git.
- [x] Relever les caracteristiques du master : 8 s, 4096 x 2304, H.264, 24 fps, environ 15,5 Mbit/s et 14,76 Mio.
- [x] Confirmer que la boucle respecte la duree cible de 6 a 12 secondes.
- [x] Confirmer que le master reste non suivi par Git avant l'implementation.
- [x] Exclure explicitement le master de Git avant toute commande `git add media`.
- [x] Confirmer l'absence de piste audio dans le master : aucun handler MP4 `soun`, uniquement le handler video `vide`.
- [x] Faire correspondre la premiere frame avec l'image poster et ses variantes paysage/portrait.
- [x] Verifier l'Asset Mux reel : qualite Plus, tier 2160p, source stockee 3840 x 2160, policy signed, sans master ni rendition MP4 statique.
- [x] Verifier l'Asset Mux Production initial : qualite Basic, tier 2160p, source 3840 x 2160 a 24 fps, policy signed uniquement, sans master ni rendition MP4 statique.
- [x] Comparer l'asset Production Basic avec l'asset Development Plus : rendu visuellement equivalent en 1080p et en 569 x 847, avec environ 20 a 30 % de bitrate en moins aux renditions courantes ; conserver Basic en Production.
- [x] Produire et verifier le crop portrait 3:4 : centre 1728 x 2304, master H.264 1080 x 1440 a 24 fps, CRF 16, 8,46 s, 4,33 Mio et sans audio.
- [x] Publier le second asset Mux Production en Basic 1080p, signed uniquement, `master_access` a `none` et sans rendition statique.
- [x] Envoyer le master directement aux environnements Mux Development et Production sans passer par le depot Git.
- [x] Verifier les renditions adaptatives 270p, 480p, 720p, 1080p, 1440p et 2160p exposees par le manifeste Mux signe.
- [ ] Conserver l'encodage WebM/MP4 local uniquement comme plan de sortie documente.

### Lecteur HLS adaptatif

- [x] Evaluer Mux Background Video et l'ecarter : son moteur leger fixe une rendition au demarrage et ne fournit pas l'ABR requis.
- [x] Retenir `hls.js` Light 1.7.0, version verrouillee et servie localement, avec HLS natif en fallback.
- [x] Remplacer completement l'iframe et l'API YouTube.
- [x] Utiliser une video muette, `playsinline`, sans controle ni interaction, avec reprise de boucle explicite au lieu de `video.loop` sur MediaSource.
- [x] Utiliser l'image principale deja selectionnee par `<picture>` comme `poster` du player.
- [x] Charger le jeton et `hls.js` seulement apres `window.load`, puis pendant une periode idle.
- [x] Declencher le fondu uniquement sur l'evenement `playing`.
- [x] Conserver l'image si l'endpoint, HLS, l'autoplay ou la video echoue ou depasse le timeout.
- [x] Mettre la video en pause lorsque l'onglet devient invisible.
- [x] Reprendre uniquement une lecture interrompue automatiquement par le passage de l'onglet en arriere-plan, avec renouvellement du jeton expire.
- [x] Selectionner l'asset portrait ou paysage avant de demander le jeton et le manifest HLS.
- [x] Initialiser l'ABR sans test en basse qualite : 720p mobile, 1080p standard, 1440p a partir de 2560 px rendus et 2160p a partir de 3840 px rendus, avec repli sur connexion contrainte.

### Chargement conditionnel

- [x] Ne pas charger la video avec `prefers-reduced-motion: reduce`.
- [x] Ne pas charger la video lorsque `navigator.connection.saveData` est actif.
- [x] Ne pas charger la video sur les connexions `slow-2g` ou `2g`.
- [x] Autoriser la video sur petit ecran uniquement si les conditions de mouvement et de reseau le permettent, avec un cadrage `cover` identique au poster.
- [x] Ne pas charger la video dans un onglet initialement invisible.
- [x] Tester le fallback lorsque JavaScript est desactive.
- [x] Tester dans Chrome le fallback lorsque l'endpoint Mux/Worker est absent : aucun player n'est cree et le poster reste intact en 569 x 847 et 1440 x 900.

### Strategie d'hebergement

- [x] Ecarter GitHub Pages pour la diffusion du master et du flux video cible.
- [x] Retenir Mux Free pour l'ingestion, le transcodage, les manifests HLS, les renditions et la diffusion CDN.
- [x] Retenir Cloudflare Workers Free uniquement pour signer les jetons courts.
- [x] Creer les comptes Mux et Cloudflare necessaires et isoler les credentials Production hors Git.
- [x] Revoquer et remplacer les identifiants Mux Development exposes : nouveau token Development, nouvelle cle de signature validee en lecture HLS, ancienne cle supprimee.
- [x] Creer l'asset Mux avec une politique `signed` uniquement ; acces sans JWT confirme refuse en HTTP 403.
- [x] Configurer la restriction de playback Production uniquement pour `reda.bouhaddar.com`, sans referrer absent ni user-agent a risque.
- [x] Creer et activer une Playback Restriction Development limitee a `localhost` et `reda.bouhaddar.com`.
- [x] Rendre la restriction Mux obligatoire dans tous les environnements, y compris localhost.
- [x] Verifier deux boucles completes sans retour au poster : aucune frame echantillonnee avec la couche video masquee.
- [x] Verifier les en-tetes de cache Mux : manifests signes non stockes et segments revalidables avec `max-age=604800`.
- [ ] Evaluer le trafic reel et le nombre de minutes delivrees apres deploiement.

## P1 - Dependances et JavaScript

- [x] Remplacer jQuery 1.8 par du JavaScript natif.
- [x] Supprimer la requete vers `ajax.googleapis.com`.
- [x] Remplacer Font Awesome 4.6 par des SVG locaux normalises.
- [x] Supprimer la requete vers `maxcdn.bootstrapcdn.com`.
- [x] Encapsuler le code applicatif JavaScript et ne conserver que le global `Hls` du fichier fournisseur local charge a la demande.
- [x] Ajouter une gestion explicite des erreurs et des timeouts.
- [x] Supprimer le recalcul JavaScript au `resize` au profit de `object-fit: cover` natif ; ne reagir qu'au changement de variante portrait/paysage.
- [ ] Verifier qu'aucune erreur n'apparait dans la console.

### Historique - solution YouTube transitoire

Cette section est conservee uniquement pour tracer la solution precedente. Elle ne represente plus le code publie.

- [x] Differer l'injection de l'API YouTube apres `window.load`, puis pendant une periode idle.
- [x] Utiliser le domaine `youtube-nocookie.com` pour le player integre.
- [x] Ajouter `playlist=VIDEO_ID` avec `loop=1`.
- [x] Ajouter `playsinline=1`.
- [x] Definir dynamiquement `origin=https://reda.bouhaddar.com` en production.
- [x] Supprimer `showinfo` et `modestbranding`, devenus obsoletes.
- [x] Ajouter `onError` et un timeout de chargement.
- [x] Suspendre le player lorsque l'onglet est invisible.
- [x] Masquer immediatement l'iframe dans tous les etats autres que `PLAYING` afin de ne pas exposer les overlays de pause, chargement ou fin de YouTube.

## P1 - Polices et CSS

- [x] Convertir ou remplacer les polices locales par des fichiers WOFF2.
- [x] Creer des subsets contenant uniquement les glyphes necessaires : 183 glyphes issus du contenu statique publie.
- [x] Ajouter `font-display: swap` ou `font-display: optional`.
- [x] Precharger uniquement les polices reellement critiques.
- [x] Supprimer les anciens formats EOT, TTF et SVG de la publication ; conserver WOFF uniquement comme fallback legacy.
- [x] Remplacer la mise en page `<table>` par `main` et Flexbox ou Grid.
- [x] Utiliser `min-height: 100svh` avec un fallback adapte.
- [x] Consolider les declarations CSS dupliquees.
- [x] Verifier le rendu a 320, 375, 569, 1440 et 2560 px.
- [x] Verifier qu'aucun texte ou controle ne se chevauche sur les viewports controles.

## P2 - SEO et partage social

- [x] Conserver une seule balise `h1` claire et descriptive.
- [x] Verifier la hierarchie semantique du contenu.
- [x] Verifier le `title`, la meta description et l'URL canonique.
- [x] Creer une image Open Graph dediee en 1200 x 630 via `npm run build:images`.
- [x] Ajouter les dimensions, le type et le texte alternatif de l'image sociale.
- [ ] Verifier les cartes LinkedIn, Open Graph et Twitter/X apres publication.
- [ ] Raccourcir les mots-cles JSON-LD aux termes les plus utiles et factuels.
- [ ] Eviter la repetition artificielle de mots-cles.
- [x] Verifier `robots.txt` et `sitemap.xml` apres deploiement.
- [x] Ajouter ou moderniser le favicon et l'icone Apple Touch.
- [ ] Tester les donnees structurees avec l'outil Google Rich Results.

## P2 - Robustesse et maintenance

- [x] Supprimer des fichiers publies les assets inutilises et formats historiques.
- [x] Normaliser les dossiers publies (`css/`, `js/`) et supprimer les pages `index.html` vides historiques.
- [x] Separer les sources de generation des assets publies et assembler un artefact Pages par liste blanche.
- [x] Minifier JavaScript et CSS dans l'artefact de production, sans source maps ni obfuscation fragile.
- [x] Minifier l'HTML de production en preservant exactement le bloc JSON-LD utilise par le hash CSP.
- [x] Conserver les fichiers de configuration IDE et les captures de revue locales hors de la publication via `.gitignore`.
- [ ] Verifier le comportement sans JavaScript.
- [ ] Verifier le comportement lorsque les domaines tiers sont bloques.
- [ ] Tester Chrome, Firefox, Safari et Edge.
- [ ] Tester iOS Safari et Android Chrome.
- [ ] Tester le mode economie de donnees et un reseau lent.
- [ ] Tester le zoom a 200 % et la navigation clavier.
- [ ] Verifier l'absence d'erreurs 404 et de contenu mixte.
- [x] Documenter la procedure d'encodage portrait et fournir `npm run build:video-portrait` avec FFmpeg/FFprobe verrouilles localement.

## Budget de performance cible

- [x] LCP inferieur a 2,5 s dans les scenarios Lighthouse mesures.
- [x] CLS inferieur a 0,1 dans les scenarios Lighthouse mesures.
- [ ] INP inferieur a 200 ms.
- [ ] Image initiale adaptee au viewport et idealement inferieure a 300 Ko.
- [ ] Video optionnelle idealement inferieure a 2 Mo par boucle initiale.
- [ ] Aucun service tiers non essentiel avant le contenu critique.
- [ ] Aucun script obsolete ou inutilise.
- [ ] Aucun flash blanc, noir ou changement brutal pendant le chargement.

## Validation finale

- [x] Executer Lighthouse mobile au moins trois fois et conserver la mediane.
- [x] Executer Lighthouse desktop au moins trois fois et conserver la mediane.
- [ ] Comparer les resultats avec les mesures initiales.
- [ ] Examiner la waterfall reseau dans les DevTools.
- [ ] Verifier la page sur une connexion mobile simulee.
- [ ] Verifier la page avec cache vide puis avec cache chaud.
- [ ] Verifier accessibilite, SEO et contrastes.
- [x] Verifier la page deployee sur `https://reda.bouhaddar.com`.
- [ ] Mettre a jour cette checklist apres chaque lot de changements.

## Journal d'avancement

| Date | Lot | Changements | Verification | Statut |
|---|---|---|---|---|
| 2026-08-22 | Audit initial | Analyse de l'image, de la video, des dependances, du chargement, de l'accessibilite et du SEO | Revue statique locale | Termine |
| 2026-08-22 | P0 | Suppression d'Universal Analytics, des contacts Skype et IRC, correction HTTPS et focus clavier | Recherche statique, controle des liens et redirection HTTP 301 vers HTTPS | Partiel : controle video et confidentialite YouTube reportes |
| 2026-08-22 | Contacts | Ajout des articles LinkedIn et d'un calendrier grise ; remplacement de Font Awesome par des SVG locaux normalises | URL LinkedIn, semantique et alignement optique verifies | Partiel : activation du calendrier en attente de son URL |
| 2026-08-22 | P1 Image et LCP | Variantes AVIF/WebP/JPEG haute qualite, crop portrait 3:4, `<picture>` prioritaire, scrim/vignette natifs et pipeline Sharp reproductible | Rendus Chrome 1440 x 900, 768 x 1024, 569 x 847 et 375 x 812 ; poids des 17 variantes controles | Partiel : mesures LCP et CLS apres deploiement |
| 2026-08-22 | P1 Video YouTube transitoire | Suppression de jQuery, API differee, player `youtube-nocookie`, boucle fiable, cadrage responsive, chargement conditionnel et masquage des etats non lus | Test du player avec API simulee ; rendu YouTube reel stabilise ; fallback visuel sans JavaScript et avec mouvement reduit ; controle reseau sans requete YouTube en mouvement reduit | Termine pour la solution transitoire ; remplacement HTML5 local encore a faire |
| 2026-08-23 | Architecture video cible | Decision Mux Free signe + Cloudflare Worker, ABR HLS, protection realiste, compatibilite, couts, perennite et plan de sortie consolides | Caracteristiques du master 4K relevees ; documentation officielle Mux, Cloudflare, HLS.js et navigateurs revue | Termine |
| 2026-08-23 | P1 Video signee - code local | Master 4K ignore par Git, poster regenere depuis la frame 0, suppression de YouTube, lecteur HTML5 avec HLS natif/hls.js ABR, plafonds de resolution signes, Worker JWT RS256, controle origine/referrer/UA, rate limiting et documentation de deploiement | Absence de piste audio confirmee ; frame/poster compares ; 5 tests Worker reussis ; bundle Wrangler valide a 12,21 Kio / 3,69 Kio gzip ; audits npm sans vulnerabilite ; build hls.js reproductible ; fallback Chrome verifie en 569 x 847 et 1440 x 900 | Partiel : comptes, upload Mux, secrets, URL Worker, CSP et tests de lecture reels en attente |
| 2026-08-25 | P1 Video signee - environnement local | Secrets Mux Development isoles dans `.dev.vars`, endpoint Worker local auto-detecte et Playback Restriction active pour localhost | 6 tests Worker reussis ; manifeste HLS restreint HTTP 200 depuis localhost ; sans referrer ou depuis un domaine tiers refuse en HTTP 403 | Termine ; rotation des credentials Development effectuee le 2026-08-26 |
| 2026-08-25 | P1 Video signee - qualite et boucle | Suppression du test de debit en rendition minimale, estimation ABR adaptee au viewport, manifeste paysage jusqu'a 2160p, `hls.js` prioritaire, derniere frame conservee pendant un stall et reprise explicite a la fin | Chrome : 720p a 569 px, 1080p a 1440 px, 1440p a 2560 px, 2160p a 3840 px ; deux boucles sans retour au poster ; source premiere/derniere frame coherente | Termine en Development ; validation multi-navigateurs restante |
| 2026-08-25 | Observabilite video | Decision de reporter Mux Data SDK : la consommation Mux et les logs Worker suffisent au lancement ; instrumentation QoE reservee au diagnostic d'incidents reels | Revue de l'integration `hls.js`, de sa valeur pour une video decorative et de son impact sur la confidentialite | Termine |
| 2026-08-25 | P1 Video signee - Production | Asset Basic 2160p signe, restriction Mux stricte, nouvelle cle de signature, secrets Cloudflare chiffres, Worker deploye et endpoint/CSP configures | 6 tests Worker ; bundle 12,21 Kio ; HLS HTTP 200 avec 6 renditions ; tiers et absence de provenance HTTP 403 ; expiration a 63 s HTTP 403 ; cache segment 7 jours ; controle CSP reproductible | Termine ; validation multi-navigateurs restante |
| 2026-08-25 | P1 Video signee - portrait Production | Comparaison Basic/Plus tranchee en faveur de Basic ; pipeline FFmpeg reproductible ; asset portrait 3:4 Basic signe et Worker redeploye | 7 tests Worker ; master 1080 x 1440 valide ; HLS 270 x 360, 480 x 640 et 720 x 960 ; Chrome 569 x 847 ; acces sans jeton, tiers et sans provenance refuses en HTTP 403 | Termine ; rotation des identifiants Development traitee separement |
| 2026-08-26 | Securite Mux Development | Nouveau token API Development verifie par `whoami`, nouvelle cle de signature creee et ancienne cle exposee revoquee | Permissions `video:read/write` et `system:read/write` ; JWT accepte par Mux Development ; manifeste paysage HTTP 200 apres rotation | Termine |
| 2026-08-26 | P1 SEO et responsive local | Image Open Graph dediee 1200 x 630, metadonnees sociales completees, tableau remplace par Flexbox, `100svh` ajoute, CSS duplique consolide et `font-display: swap` active | Image sociale 92 Ko valide ; CSP valide ; rendu Chrome viewport CSS 320 x 812 et 375 x 812 sans debordement ; Lighthouse SEO 100 | Termine ; cartes sociales externes restantes |
| 2026-08-26 | P1 Polices WOFF2 | Conversion des fontes RB en WOFF2, priorite WOFF2 dans `@font-face` et prechargement des deux graisses critiques | Subsets `rb-Light.woff2` 9,8 Ko et `rb-Regular.woff2` 10,1 Ko servis par Chrome en HTTP 200 ; anciens formats retires | Termine |
| 2026-08-26 | P1 Polices WOFF2 - subset | Subset des deux fontes a 183 glyphes, poids reduit a 9,8 Ko et 10,1 Ko, retrait des formats EOT/TTF/SVG | Chrome 375 x 812 conserve le rendu et charge les WOFF2 en HTTP 200 ; CSP valide | Termine ; source TTF conservee dans l'historique Git |
| 2026-08-26 | Hygiene du depot | Dossiers d'assets renommes `s/` vers `css/` et `j/` vers `js/`, pages vides supprimees, references et controle CSP mis a jour | Build HLS reproductible, recherche des anciens chemins et `git diff --check` | Termine |
| 2026-08-26 | Hygiene du depot - hebergement | Suppression de `.htaccess`, sans effet sur GitHub Pages et source de confusion pour la configuration HTTPS/cache | Audit de `CNAME`, GitHub Pages et contenu du fichier | Termine |
| 2026-08-26 | Packaging de production | Source image deplacee dans `scripts/assets/`, fallback 2560 px optimise et workflow Pages avec artefact en liste blanche | Builds images/HLS, CSP, assemblage local de 33 fichiers sans scripts, Worker ni manifests Node | Termine ; activation Pages apres push |
| 2026-08-26 | Packaging de production - minification | Ajout d'esbuild pour minifier les copies JavaScript/CSS dans `_site`, suppression des references source map HLS | Artefact local : JS 6,4 Ko, CSS 4,5 Ko, aucune source map ni fichier de developpement | Termine ; validation visuelle apres publication |
| 2026-08-26 | Smoke test Production | Site, assets critiques, restrictions Worker et URL HLS signee controles sur le domaine public ; HTML verifie sans secrets ni YouTube | HTTP 200 pour la page/assets ; Worker sans origine et tiers HTTP 403 ; origine autorisee HTTP 200 ; manifest HLS accessible | Termine ; Lighthouse et tests multi-navigateurs restants |
| 2026-08-26 | Lighthouse Production - premiere passe | Mesures Lighthouse mobile et desktop sur `https://reda.bouhaddar.com` | Mobile : performance 99, accessibilite 100, bonnes pratiques 100, SEO 100, LCP 1,4 s, CLS 0 ; desktop : performance 95, accessibilite 100, bonnes pratiques 100, SEO 100, LCP 1,2 s, CLS 0, TBT 110 ms | Premiere passe terminee ; trois repetitions, waterfall et multi-navigateurs restants |
| 2026-08-26 | Lighthouse Production - medianes | Deux repetitions supplementaires par profil avec Lighthouse 13.4.1 et reseau mobile simule | Mobile mediane : performance 82, accessibilite 100, bonnes pratiques 100, SEO 100, LCP 1,61 s, CLS 0, TBT 714 ms ; desktop mediane : performance 99, accessibilite 100, bonnes pratiques 100, SEO 100, LCP 0,88 s, CLS 0, TBT 10 ms | Mediane enregistree ; variabilite mobile liee au temps de blocage du bundle/video a analyser |
| 2026-08-26 | Packaging de production - HTML | Minification prudente de `index.html` dans `_site`, sans modifier le JSON-LD ni son hash CSP | HTML 11,4 Ko contre 12,0 Ko source ; JSON-LD identique ; aucune source map | Termine |
| 2026-08-26 | Identite favicon | Reconstruction vectorielle fidele du `R` du favicon 16 px, generation SVG, PNG 16/32 px et Apple Touch 180 px ; `.ico` historique conserve en fallback | Variantes generees par Sharp, artefact Pages et CSP valides | Termine |
| 2026-08-26 | QA HTML automatisee | Ajout de `npm run check:html` pour controler h1, metadonnees, chemins d'assets, absence de YouTube et absence de secrets client | Controle local passe ; integre au workflow Pages | Termine |

## References pour la decision video

- [Mux Free et tarification](https://www.mux.com/pricing)
- [Mux - lecture securisee par JWT et restrictions](https://www.mux.com/docs/guides/secure-video-playback)
- [Mux Background Video](https://www.mux.com/docs/guides/mux-background-video)
- [Mux - compatibilite navigateurs](https://www.mux.com/docs/guides/player-faqs)
- [Mux - historique et equipe](https://www.mux.com/team)
- [Mux - etat des services](https://status.mux.com/)
- [Cloudflare Workers - tarification et quotas](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare - histoire et envergure](https://www.cloudflare.com/about/)
- [HLS.js - compatibilite](https://github.com/video-dev/hls.js/)
- [MDN - Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation)
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)
