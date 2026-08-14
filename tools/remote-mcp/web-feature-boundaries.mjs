import nodePath from "node:path";

function isInside(file, directory) {
  return file === directory || file.startsWith(`${directory}${nodePath.sep}`);
}

function getFeatureName(file, featuresRoot) {
  if (!isInside(file, featuresRoot)) {
    return null;
  }

  const [featureName] = nodePath.relative(featuresRoot, file).split(nodePath.sep);
  return featureName || null;
}

function isFeaturePublicEntry(resolved, featureRoot) {
  const publicEntries = [
    featureRoot,
    nodePath.join(featureRoot, "index"),
    nodePath.join(featureRoot, "index.ts"),
    nodePath.join(featureRoot, "index.tsx"),
    nodePath.join(featureRoot, "index.js"),
    nodePath.join(featureRoot, "index.jsx"),
  ];

  return publicEntries.includes(resolved);
}

/**
 * 웹 셸·공유 계층·추첨기 기능의 상대 import가 수직 기능 경계를 지키는지 판정한다.
 * 파일시스템을 읽지 않아 기능 디렉터리 생성 전과 이동 중에도 같은 fixture로 검증할 수 있다.
 */
export function findWebFeatureImportFailures({ importer, specifier, webRoot }) {
  if (!specifier.startsWith(".") || !isInside(importer, webRoot)) {
    return [];
  }

  const featuresRoot = nodePath.join(webRoot, "features");
  const sharedRoot = nodePath.join(webRoot, "shared");
  const resolved = nodePath.resolve(nodePath.dirname(importer), specifier);
  const importerFeature = getFeatureName(importer, featuresRoot);
  const targetFeature = getFeatureName(resolved, featuresRoot);
  const importerIsShared = isInside(importer, sharedRoot);
  const targetIsShared = isInside(resolved, sharedRoot);
  const targetIsWeb = isInside(resolved, webRoot);

  if (importerIsShared && targetFeature) {
    return [`web/shared에서 추첨기 기능 의존성 금지: ${specifier}`];
  }

  if (importerFeature) {
    if (targetFeature && targetFeature !== importerFeature) {
      return [
        `웹 추첨기 기능 간 교차 의존성 금지 (${importerFeature} -> ${targetFeature}): ${specifier}`,
      ];
    }

    if (targetIsWeb && !targetFeature && !targetIsShared) {
      return [
        `웹 추첨기 기능에서 셸 역방향 의존성 금지 (${importerFeature}): ${specifier}`,
      ];
    }

    return [];
  }

  if (targetFeature) {
    const targetFeatureRoot = nodePath.join(featuresRoot, targetFeature);

    if (!isFeaturePublicEntry(resolved, targetFeatureRoot)) {
      return [
        `웹 셸은 추첨기 기능 공개 진입점만 import 가능 (${targetFeature}): ${specifier}`,
      ];
    }
  }

  return [];
}
