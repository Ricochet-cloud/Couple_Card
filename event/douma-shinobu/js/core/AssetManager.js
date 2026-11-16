/**
 * AssetManager
 * 
 * - 이미지 및 오디오 리소스를 비동기로 프리로드 및 캐싱
 * - 이미지 로드 실패 시에도 예외를 전파하지 않고 Graceful Fallback 상태 플래그를 설정
 * - 애셋이 존재하지 않는 개발 단계에서도 게임 루프가 중단 없이 가동되도록 보장
 */

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.status = new Map(); // key -> 'loading' | 'loaded' | 'error' | 'fallback'
    this.listeners = [];
  }

  /**
   * 단일 이미지 비동기 로드
   * @param {string} key 
   * @param {string} src 
   * @returns {Promise<HTMLImageElement | null>}
   */
  loadImage(key, src) {
    if (this.images.has(key) && this.status.get(key) === 'loaded') {
      return Promise.resolve(this.images.get(key));
    }

    this.status.set(key, 'loading');

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // CORS 지원

      img.onload = () => {
        this.images.set(key, img);
        this.status.set(key, 'loaded');
        this._notify(key, 'loaded');
        resolve(img);
      };

      img.onerror = () => {
        // 이미지가 없어도 게임이 멈추지 않도록 fallback 상태로 기록
        console.warn(`[AssetManager] 애셋 로드 실패 또는 미배치: "${src}". 임시 절차적 렌더러(Procedural Fallback)로 대체합니다.`);
        this.status.set(key, 'fallback');
        this._notify(key, 'fallback');
        resolve(null);
      };

      img.src = src;
    });
  }

  /**
   * 여러 애셋 동시 로드
   * @param {Array<{key: string, src: string}>} assetList 
   */
  async loadAll(assetList) {
    const promises = assetList.map(({ key, src }) => this.loadImage(key, src));
    return Promise.all(promises);
  }

  /**
   * 이미지 애셋 획득 (로딩 성공 시 이미지 반환, 실패 시 null)
   */
  getImage(key) {
    return this.status.get(key) === 'loaded' ? this.images.get(key) : null;
  }

  /**
   * 실제 애셋이 정상 로드되었는지 확인
   */
  hasLoaded(key) {
    return this.status.get(key) === 'loaded';
  }

  /**
   * 애셋 상태 조회
   */
  getStatus(key) {
    return this.status.get(key) || 'none';
  }

  onStateChange(cb) {
    this.listeners.push(cb);
  }

  _notify(key, state) {
    for (const cb of this.listeners) {
      cb(key, state);
    }
  }
}

// 싱글톤 인스턴스 기본 익스포트
export const assetManager = new AssetManager();
