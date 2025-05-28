class UserFeedbackStore {
  constructor() {
    this.dbName = 'ClipTaggerDB';
    this.version = 1;
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('audioFeedback')) {
          const audioStore = db.createObjectStore('audioFeedback', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          audioStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('tagFeedback')) {
          const tagStore = db.createObjectStore('tagFeedback', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          tagStore.createIndex('tag', 'tag', { unique: false });
          tagStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('customTags')) {
          const customTagStore = db.createObjectStore('customTags', { 
            keyPath: 'tag' 
          });
          customTagStore.createIndex('usage', 'usage', { unique: false });
        }
      };
    });
  }

  async saveAudioFeedback(audioHash, originalTags, correctedTags, audioFeatures) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['audioFeedback'], 'readwrite');
    const store = transaction.objectStore('audioFeedback');

    const feedback = {
      audioHash,
      originalTags,
      correctedTags,
      audioFeatures,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(feedback);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTagFeedback(tag, feedback, audioHash) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['tagFeedback'], 'readwrite');
    const store = transaction.objectStore('tagFeedback');

    const tagFeedback = {
      tag,
      feedback, // 'positive', 'negative', or 'custom'
      audioHash,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(tagFeedback);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCustomTag(tag) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['customTags'], 'readwrite');
    const store = transaction.objectStore('customTags');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(tag);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        const tagData = existing ? 
          { ...existing, usage: existing.usage + 1 } :
          { tag, usage: 1, timestamp: Date.now() };

        const putRequest = store.put(tagData);
        putRequest.onsuccess = () => resolve(putRequest.result);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getCustomTags(limit = 20) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['customTags'], 'readonly');
    const store = transaction.objectStore('customTags');
    const index = store.index('usage');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Descending order
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTagFeedback(tag = null) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['tagFeedback'], 'readonly');
    const store = transaction.objectStore('tagFeedback');

    return new Promise((resolve, reject) => {
      let request;
      if (tag) {
        const index = store.index('tag');
        request = index.getAll(tag);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAudioFeedback(limit = 100) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['audioFeedback'], 'readonly');
    const store = transaction.objectStore('audioFeedback');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Most recent first
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Generate a simple hash for audio content
  async hashAudioFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  async clearAllData() {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['audioFeedback', 'tagFeedback', 'customTags'], 'readwrite');
    
    await Promise.all([
      new Promise((resolve, reject) => {
        const request = transaction.objectStore('audioFeedback').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = transaction.objectStore('tagFeedback').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = transaction.objectStore('customTags').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
  }
}

export default UserFeedbackStore;