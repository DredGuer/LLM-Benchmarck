# Implémentation LLM-Benchmarker — 0.17.0

Cette version applique la convention commune documentaire 0.1 côté benchmark. Le document commun reste identique dans les deux dépôts ; son statut documentaire ne signifie pas que l’importeur NVNC reconnaît déjà les nouveaux champs.

## Comportement

Le nom d’origine reste le seul identifiant envoyé à Ollama/MLX/autres runners et celui conservé dans SQLite. Les noms proposés apparaissent dans les résultats, le panneau modèle et le Markdown. Les données historiques ne sont ni renommées ni réécrites. Une réexportation ne modifie pas la version capturée au moment du test.

L’inventaire actuellement collecté sur Apple ne prouve pas la famille précise du Mac ni la taille de son écran : `Apple_M3Pro_36Go_12CPU_18GPU` est provisoire. Aucun MacBook Pro 16 pouces n’est inventé. Les fiches portables/fixes précises et les classifications semi-pro nécessiteront des informations matérielles supplémentaires ou une confirmation explicite.

Les noms GPU utilisent la capacité de chaque carte, pas la somme de leurs VRAM. Le CPU reste distinct. Les catégories sont des indications pour le catalogue ; elles ne prouvent pas quelles cartes ont exécuté le test. Un service Ollama local n’est pas classé cloud. Un proxy Ollama Cloud est distingué d’un endpoint Ollama distant générique. Le matériel local d’une API distante reste celui du client.

Pour un MoE, le nombre total déclaré prévaut sur la taille nominale lorsqu’il est disponible. Pour les autres cas, la taille provient de `details.parameter_size` quand ce champ est exprimé en milliards, sinon du nombre total de paramètres déclaré. Un tag `12b` seul ne prouve pas la taille. Une quantification absente reste inconnue. GGUF/MLX sont des formats/variantes, distincts du runner ; `safetensors` seul ne démontre pas une variante MLX. Les sources HF explicites sont conservées ; aucune révision n’est devinée. Les fine-tunes et namespaces gardent un suffixe pour éviter une fusion abusive.

## Exports

- Export normalisé optionnel : rapport 2.3.0 et bundle 1.1.0. `naming` transporte convention/algorithme, nom original, nom normalisé, clé minuscule et état provisoire. Le modèle conserve ID exact, digest, métriques et paramètres ; source identifiable et révision connue sont sélectionnées explicitement.
- Export compatible par défaut et automatique : contrats 2.0/2.1/2.2 et bundle 1.0 inchangés. Aucun champ `naming` n’est ajouté silencieusement. Utiliser ce JSON pour NVNC actuel.

NVNC doit intégrer les nouveaux schémas et leur rapprochement avant de recevoir le format normalisé. Aucune modification du dépôt NVNC ni migration serveur n’est effectuée dans cette étape. Les labels ne sont pas des identifiants uniques : une association exige une source ou un alias unique, avec contrôle des cas ambigus. Une catégorie GPU ne certifie pas le placement d’inférence.

## Contrôles

```bash
node backend/catalogue-naming.test.cjs
node backend/community-export.test.cjs
node backend/community-interop.test.cjs ../NVNC-Tech
node schemas/test.cjs
```

Les tests couvrent tailles inconnues, paramètres totaux MoE, quantifications, fine-tunes/sources distinctes, caractères sûrs, Apple provisoire, mémoire par GPU, cloud, immutabilité, compatibilité de l’export par défaut et les nouveaux contrats. Le nouveau schéma a aussi été validé avec un validateur complet Draft 2020-12 (Ajv). Aucun vrai test Mac ou import serveur NVNC du format 2.3 n’est attesté ici.
