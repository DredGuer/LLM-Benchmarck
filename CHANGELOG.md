# Changelog

Historique des changements de LLM Benchmarker. Les dates correspondent aux intégrations dans le dépôt. Les entrées antérieures à ce fichier ont été reconstituées à partir des commits ; ce ne sont pas des releases ou tags ajoutés rétroactivement.

## Versions actuelles

| Élément | Version | Référence |
|---|---|---|
| Application / interface / producteur des exports | **0.09.0** | `js/core/version.js` |
| Backend Node | 1.1.0 | `package.json` |
| Protocole de génération | 0.09 | `js/core/benchmark.js` |
| Batterie agentique | 2.0.1 | `backend/agentic-suite.js` |
| Rapport communautaire | 2.2.0 ; compatibilité 2.0.0/2.1.0 | `schemas/community-v2.schema.json` |
| Bundle de rapports communautaires | 1.0.0 | `schemas/community-bundle.schema.json` |
| Inventaire Apple | 1.0.0 | `backend/apple-inventory.js` |

Ces numéros désignent des composants différents. Les résultats historiques et exemples synthétiques conservent leur version d’origine. Le suffixe des URL de scripts sert à invalider le cache ; il ne désigne pas nécessairement la version de l’application.

## [0.09.0] — 2026-10-06

Les quatre volets de fiabilisation ont été réalisés dans cet ordre et publiés ensemble.

### 1. Provenance

- Version d’application capturée au moment de chaque nouvelle passe ; distincte de la version du producteur d’export. Les anciens historiques restent explicitement inconnus.
- Client navigateur distingué du runner et du moteur/backend non rapporté. Localisation d’endpoint déclarée sans exporter son URL ou ses secrets.
- MLX : horodatage de l’événement maximal corrigé, collecte séparée, âge/fraîcheur, événements futurs exclus et chevauchements de télémétrie signalés. Attribution au modèle toujours non vérifiée.
- Backend 1.1.0 et schéma communautaire 2.2.0 ; anciens rapports conservés et compatibles.

### 2. Verdicts

- Exécution terminée, interruption/erreur technique, objectif atteint, conformité et justesse séparés.
- Critères échoués visibles immédiatement. Un échec de conformité n’est plus affiché comme une panne du runner.
- Batterie agentique 2.0.1 : contenu de la phrase d’abstention avec apostrophes équivalentes séparé de la reproduction exacte. Anciennes évaluations conservées.

### 3. Justesse classique

- Activation facultative de six cas structurés : deux durées, deux plans de transport/traitement et deux vecteurs Fibonacci.
- Évaluateurs originaux déterministes 1.0.0 : valeurs/conversions, dépendances d’actions et sorties numériques ; aucune recherche d’un mot isolé pour décider de la justesse.
- Statut non évalué pour prompts libres, incomplet pour réponses tronquées ; critères/version de cas dans les cartes, statistiques, assistant et exports. Aucun code généré exécuté, aucune qualité générale revendiquée.

### 4. Campagnes contrôlées

- Ollama : trois répétitions par cas, deux contextes explicites (8192/16384 proposés), température 0, même plafond de sortie, chauffe par contexte et ordre des contextes alterné entre campagnes du navigateur.
- Vérification du contexte chargé. Arrêt en cas de valeur absente/différente ; exclusion des passes non vérifiées des comparaisons contrôlées. Interruption empêche la série suivante.
- ID partagé et ordre exportés, séries sauvegardées séparément dans l’historique et conservées ensemble à l’écran. Les contrôles de paramètres et de saut/reprise sont verrouillés pendant la campagne.
- Cache géré par le runner, sans reset garanti ; cela reste une limite de comparaison.

### Validation et suite

- 15 suites automatisées passent : provenance/justesse/campagnes, télémétrie, verdicts, schémas et régression. Les flux et modèles sont simulés dans les tests automatisés ; aucune campagne réelle n’a été exécutée sur le Mac de l’utilisateur par cette mise à jour.
- README, guides techniques/backend/agentique, contrat d’export et changelog actualisés.
- Prochaine validation : modèles réels sur le Mac, trois répétitions aux deux contextes ; Exo et site communautaire ensuite.

## [0.08] — 2026-10-06

### Interface

- Quatre mesures principales par carte : TTFT, tokens/s moyens sur la durée totale, pic mémoire échantillonné avec sa source et temps total. Les valeurs inconnues restent `N/A`, y compris sur les essais en erreur.
- Volet **Toutes les métriques et conditions**, fermé au départ : tokens générés, réponse finale, mémoire moyenne/allocation déclarée, MLX, swap, E/S, contexte et chargement/cache.
- Bilan agentique visible ; critères, compteurs, cadre système, traces et téléchargements regroupés dans **Critères, outils et détails agentiques**.
- Suppression du badge mémoire redondant et grille adaptée aux petits écrans. Navigation native des volets à la souris, au toucher et au clavier.
- Collecte, historique, statistiques et contenus des exports préservés ; version producteur actualisée en 0.08.

### Documentation et maintenance

- README et guide technique actualisés. Les consignes imposent désormais une hausse de version, le changelog et les guides concernés à chaque implémentation validée.
- Validation : suites exports, agentique et schémas ; syntaxe JavaScript et contrôles de structure HTML. Pas de certification visuelle sur tous les navigateurs.

## [0.07] — 2026-10-06

### Ajouté

- Ce changelog à la racine, avec l’état des versions et l’historique vérifiable.
- Version d’application centralisée, utilisée par les libellés de l’interface et les producteurs des exports JSON/Markdown.
- Consigne de mise à jour du changelog et de la documentation pour chaque modification validée.

### Corrigé

- Le Markdown décrit désormais le schéma/version du JSON réellement inclus, y compris les bundles et rapports agentiques 2.1.0. Le JSON est construit une seule fois afin de conserver le même identifiant de rapport.
- Les anciens résultats sans version de protocole sont identifiés comme inconnus, sans leur attribuer artificiellement une version.
- Versions de l’interface, des exports et des guides harmonisées en 0.07 ; scripts modifiés rechargés avec de nouveaux paramètres de cache.

### Validation et limites

- Contrôle des versions dans les libellés HTML, exports et guides ; tests des exports et compatibilité des schémas.
- Les vérifications automatisées ne certifient pas le rendu visuel de tous les navigateurs.
- Le comparateur strict de la phrase d’abstention agentique demeure inchangé : une apostrophe différente peut faire échouer la conformité du texte malgré l’absence correcte d’appel d’outil. Cette correction fonctionnelle reste à traiter.

## [0.06] — évolutions intégrées le 2026-10-05

Plusieurs changements ont été publiés sous le même numéro d’interface 0.06. Les commits ci-dessous permettent d’identifier les étapes sans inventer de versions intermédiaires.

### Agentique approfondi

[eee2be4](https://github.com/DredGuer/LLM-Benchmarck/commit/eee2be44c1a3c96e50b10d4ffba9e0daac2ded6e)

- Batterie de six tâches : choix d’outils, rapport fichiers, reprise après erreur, clarification, changement d’objectif et abstention.
- Cadre système, appels natifs, streaming NDJSON/SSE et préservation de la conversation ; ajouts à la campagne de génération.
- Évaluations indépendantes des états, fichiers et dépendances ; objectif atteint séparé de la conformité.
- Suivi local des messages, réflexion rapportée, appels et retours ; profils statistiques par capacité.
- Export communautaire 2.1.0 sans traces, arguments bruts ni contenus des fichiers ; compatibilité 2.0.0 conservée.
- Méthodologie et limites documentées ; 14 suites automatisées validées avant publication. Les tests des adaptateurs utilisent des réponses simulées.

### Première épreuve agentique fichiers

[32b1fd5](https://github.com/DredGuer/LLM-Benchmarck/commit/32b1fd558cef7a298d635da11768800cfa139243)

- Outils fichiers restreints, vérification backend, budgets, nettoyage et statistiques de réussite séparées.
- Ancien scénario conservé pour compatibilité ; isolation applicative sans shell ni accès arbitraire aux documents utilisateur.

### Assistant, statistiques et ergonomie

- [5dbdc6a](https://github.com/DredGuer/LLM-Benchmarck/commit/5dbdc6a) : analyse de l’historique, mentions `@` des modèles et conclusions prudentes.
- [b6deaa9](https://github.com/DredGuer/LLM-Benchmarck/commit/b6deaa9) : sélection des passes, moyennes par modèle et graphiques line/area pour débit et prefill.
- [c723684](https://github.com/DredGuer/LLM-Benchmarck/commit/c723684) : panneau d’analyse opaque et champs lisibles.
- [b1f96a7](https://github.com/DredGuer/LLM-Benchmarck/commit/b1f96a7) : bulles d’aide et noms de modèles dans les fichiers JSON.
- [bec0660](https://github.com/DredGuer/LLM-Benchmarck/commit/bec0660) : une répétition par défaut, mesures fiabilisées et assistant d’analyse facultatif.
- [e085ab5](https://github.com/DredGuer/LLM-Benchmarck/commit/e085ab5) : chauffe mesurée, suivi du swap, remise à zéro des campagnes et statistiques historiques.

### Inventaire, ressources et schéma commun

- [c52316a](https://github.com/DredGuer/LLM-Benchmarck/commit/c52316a) : schéma communautaire commun, exemples Apple/agentique/Linux multi-GPU/Exo, validateurs et charte d’utilisation. Les exemples Exo et multi-GPU n’impliquent pas leur collecte ou exécution effective.
- [c6c23fe](https://github.com/DredGuer/LLM-Benchmarck/commit/c6c23fe) : inventaire Apple CPU, classes de cœurs, mémoire unifiée, GPU, SSD physiques et provenance.
- [3f0df00](https://github.com/DredGuer/LLM-Benchmarck/commit/3f0df00) : lecture des cœurs GPU Apple et transport Apple Fabric des SSD.
- Télémétrie documentée dans [APPLE_RESOURCES.md](backend/APPLE_RESOURCES.md) : swap/compression système, compteurs disque et événements MLX lorsque disponibles. Une RSS, une allocation déclarée et un pic MLX restent des mesures distinctes ; aucune vitesse maximale SSD n’est déduite.

## À suivre

- Valider les nouveaux verdicts et évaluateurs avec des campagnes réelles.
- Étendre les cas de justesse et les données de preuve après validation des six premiers cas.
- Répéter les campagnes sur modèles réels dans des conditions comparables.
- Exo et exécution distribuée restent reportés ; préparer ensuite le site communautaire et l’import validé des exports.
