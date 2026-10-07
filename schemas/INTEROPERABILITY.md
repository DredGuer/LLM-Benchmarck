# LLM-Benchmarker ↔ NVNC-Tech

Compatibilité intégrée : LLM-Benchmarker 0.16.0, NVNC-Tech 0.3.1. La version de l’application/producteur ne remplace pas la version du schéma. Réexporter un ancien test ne réécrit pas sa provenance.

## Parcours utilisateur

1. Benchmark : télécharger l’export **communautaire JSON** (manuel ou fichier `.json` du dossier `export/` d’une campagne automatique).
2. NVNC : sélectionner le fichier, **Vérifier le format**, vérifier le bilan (chauffes, agentiques, incomplets), se connecter puis envoyer.
3. Consulter les lignes de Benchmarks et l’historique de son profil. Les noms exacts modèle/quantification sont conservés, sans créer de fiche catalogue fictive.

Ne pas envoyer une sauvegarde SQLite (`llmb-local-backup`) ou un Markdown : ils contiennent des données privées. Aucune connexion automatique NVNC n’est mise en place ici. Le JSON communautaire exclut les prompts, réponses, arguments d’outils et contenus des fichiers ; des textes descriptifs et caractéristiques de machine restent à vérifier avant partage.

## Contrat

| Sujet | Export | Import NVNC |
|---|---|---|
| Rapport | `llm-benchmarker.community` 2.0/2.1/2.2 | Schéma complet Draft 2020-12 + contrôles sémantiques |
| Plusieurs runners/inventaires | Bundle 1.0 | Chaque sous-rapport conserve son propre ID |
| Génération | Débit génération ≠ débit total | Débit génération dans la colonne ; métriques originales conservées |
| Agentique | Objectif, conformité, justesse, outils/étapes expurgés | Conservation séparée ; pas de faux débit génération de la tâche |
| Chauffe / partiel / échec | Phase et statut conservés | Libellés distincts, jamais convertis en réussite |
| Mémoire | RSS, allocation déclarée, swap et MLX distincts | RSS seule dans la colonne mémoire ; autres mesures dans le payload |
| Matériel cloud | Inventaire client ≠ moteur distant | Matériel d’inférence inconnu, pas la RAM du client |
| Versions | Producteur + provenance capturée | Préservées ; rejet des schémas inconnus |
| Doublons | ID de test stable ; ID de rapport nouveau au réexport | Identité et contenu séparés, réexport identique ignoré ; conflit refusé atomiquement |

NVNC limite à 20 MiB/fichier, 32 rapports, 10 000 tests, identifiants rapport/test 36 caractères et nom modèle 200 caractères (stockage MySQL). Aucun test distribué ou à concurrence non explicitement égale à 1 n’est importé ; un bilan indique les exclusions. Les rapports synthétiques et champs hors contrat sont refusés, sans suppression silencieuse. Les flags de confidentialité ne prouvent pas à eux seuls l’absence de secrets dans les textes autorisés. Ces données restent déclaratives, pas certifiées par NVNC.

## Synchronisation et tests

La source des deux schémas est `LLM-Benchmarker/schemas/`. NVNC embarque une copie dans `lib/llmb-contract/` (licence Apache-2.0) et les contrôles sémantiques de `schemas/validate.cjs`. Ne pas faire diverger ces copies lors d’une évolution du contrat. Ajv valide le schéma statique local ; aucune résolution de références distante.

Avec les deux dépôts côte à côte :

```bash
# Depuis LLM-Benchmarker
node backend/community-interop.test.cjs ../NVNC-Tech
node schemas/interop-fixtures.cjs ../NVNC-Tech/scripts/fixtures/interop

# Depuis NVNC-Tech
pnpm run test:llmb
```

Les fixtures sont des données fabriquées pour les tests, jamais des contributions réelles. Les cas génération/bundle/MLX/cloud sont générés par le véritable exporteur ; les cas agentiques proviennent des fixtures de contrat. Les tests MySQL simulent le pool et contrôlent la transaction, les doublons et conflits ; l’import authentifié sur le serveur déployé reste à vérifier après sa migration.
