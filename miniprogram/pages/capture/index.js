const config = require('../../config');
const api = require('../../utils/api');

const fs = wx.getFileSystemManager();

function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (result) => resolve(result.data),
      fail: reject
    });
  });
}

function imageInfo(src) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src,
      success: resolve,
      fail: () => resolve({ width: 0, height: 0, type: 'jpeg' })
    });
  });
}

function compressImage(src) {
  return new Promise((resolve) => {
    wx.compressImage({
      src,
      quality: config.imageQuality,
      success: (result) => resolve(result.tempFilePath),
      fail: () => resolve(src)
    });
  });
}

function saveFile(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath,
      success: (result) => resolve(result.savedFilePath),
      fail: reject
    });
  });
}

function removeSavedFile(filePath) {
  if (!filePath) return;
  wx.removeSavedFile({ filePath, fail: () => {} });
}

function createClientTaskId() {
  return `wx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

Page({
  data: {
    loading: true,
    loadError: '',
    projects: [],
    projectIndex: -1,
    communities: [],
    communityIndex: -1,
    buildings: [],
    buildingIndex: -1,
    householdCount: '',
    problemGroups: [],
    problemGroupIndex: -1,
    problemItems: [],
    problemIndex: -1,
    photos: [],
    activePhotoIndex: -1,
    uploadedPhotos: [],
    uploadedCount: 0,
    maxPhotos: config.maxPhotos,
    uploading: false,
    uploadProgress: 0,
    uploadMessage: '',
    lastError: ''
  },

  onLoad(options = {}) {
    this.isSharedEntry = options.share === '1';
    this.restoreDraft();
    this.loadInitialData();
  },

  onShareAppMessage() {
    return {
      title: '智更现场采集',
      path: '/pages/capture/index?share=1'
    };
  },

  onUnload() {
    this.persistDraft();
  },

  restoreDraft() {
    if (this.isSharedEntry) return;
    const draft = wx.getStorageSync('smartRenewCaptureDraft');
    if (!draft || !Array.isArray(draft.photos)) return;
    this.pendingDraft = draft;
    const photos = draft.photos
      .filter((item) => item?.path)
      .map((item) => ({ ...item, status: 'pending' }));
    this.setData({
      householdCount: draft.householdCount || '',
      photos,
      activePhotoIndex: photos.length ? 0 : -1,
      uploadedCount: Number(draft.uploadedCount) || 0
    });
  },

  persistDraft() {
    const project = this.data.projects[this.data.projectIndex];
    const community = this.data.communities[this.data.communityIndex];
    const building = this.data.buildings[this.data.buildingIndex];
    const storageKey = this.isSharedEntry
      ? 'smartRenewSharedCaptureDraft'
      : 'smartRenewCaptureDraft';
    wx.setStorageSync(storageKey, {
      projectId: project?.id || community?.projectId || '',
      communityId: community?.id || '',
      buildingId: building?.id || '',
      householdCount: this.data.householdCount,
      uploadedCount: this.data.uploadedCount,
      photos: this.data.photos
    });
  },

  async loadInitialData() {
    this.setData({ loading: true, loadError: '' });
    try {
      const [projectResult, problemResult] = await Promise.all([
        api.get('/api/field/projects'),
        api.get('/api/field/problem-types')
      ]);
      const projects = projectResult.items || [];
      const selectedProjects = config.projectId
        ? projects.filter((item) => String(item.id) === String(config.projectId))
        : projects;
      if (!selectedProjects.length) throw new Error('智更平台尚未创建可采集的项目');
      const problemGroups = problemResult.items || [];
      this.setData({
        projects: selectedProjects,
        projectIndex: !this.isSharedEntry && selectedProjects.length === 1 ? 0 : -1,
        communities: [],
        problemGroups,
        loading: false
      });
      if (!this.isSharedEntry && selectedProjects.length === 1) {
        await this.loadCommunities();
      }
      if (!this.isSharedEntry) await this.applyDraftSelection();
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '读取数据失败' });
    }
  },

  async applyDraftSelection() {
    const draft = this.pendingDraft;
    if (!draft) return;
    const projectIndex = this.data.projects.findIndex(
      (item) => String(item.id) === String(draft.projectId)
    );
    if (projectIndex >= 0) {
      this.setData({ projectIndex });
      await this.loadCommunities(draft.communityId, draft.buildingId);
    }
    const project = this.data.projects[this.data.projectIndex];
    const community = this.data.communities[this.data.communityIndex];
    const building = this.data.buildings[this.data.buildingIndex];
    const photos = this.data.photos.map((photo) => ({
      ...photo,
      clientTaskId: photo.clientTaskId || createClientTaskId(),
      capturedAt: photo.capturedAt || new Date().toISOString(),
      projectId: photo.projectId || String(project?.id || ''),
      projectName: photo.projectName || project?.name || '',
      communityId: photo.communityId || community?.id || '',
      communityName: photo.communityName || community?.name || '',
      buildingId: photo.buildingId || building?.id || '',
      buildingName: photo.buildingName || building?.name || '',
      householdCount: photo.householdCount ?? (
        draft.householdCount ? Number(draft.householdCount) : null
      ),
      problemCode: photo.problemCode || draft.problemCode || ''
    }));
    this.setData({ photos });
    this.applyActivePhotoProblem();
    this.pendingDraft = null;
  },

  async onProjectChange(event) {
    this.setData({
      projectIndex: Number(event.detail.value),
      communities: [],
      communityIndex: -1,
      buildings: [],
      buildingIndex: -1,
      householdCount: '',
      uploadedPhotos: [],
      uploadedCount: 0
    });
    await this.loadCommunities();
    this.persistDraft();
  },

  async loadCommunities(preferredCommunityId = '', preferredBuildingId = '') {
    const project = this.data.projects[this.data.projectIndex];
    if (!project) return;
    try {
      wx.showNavigationBarLoading();
      const result = await api.get(`/api/field/projects/${project.id}/communities`);
      const communities = (result.items || []).map((community) => ({
        ...community,
        projectId: String(project.id),
        projectName: project.name,
        displayName: community.name
      }));
      const communityIndex = preferredCommunityId
        ? communities.findIndex((item) => item.id === preferredCommunityId)
        : -1;
      this.setData({ communities, communityIndex });
      if (communityIndex >= 0) {
        await this.loadBuildings(preferredBuildingId);
        await this.loadUploadedPhotos();
      }
    } catch (error) {
      wx.showToast({ title: error.message || '小区读取失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  async onCommunityChange(event) {
    const communityIndex = Number(event.detail.value);
    const community = this.data.communities[communityIndex];
    this.setData({
      communityIndex,
      buildings: [],
      buildingIndex: -1,
      householdCount: ''
    });
    await this.loadBuildings();
    await this.loadUploadedPhotos();
    this.persistDraft();
  },

  async loadUploadedPhotos() {
    const project = this.data.projects[this.data.projectIndex];
    const community = this.data.communities[this.data.communityIndex];
    if (!project || !community) {
      this.setData({ uploadedPhotos: [], uploadedCount: 0 });
      return;
    }
    try {
      const result = await api.get(
        `/api/photos?projectId=${encodeURIComponent(project.id)}&communityId=${encodeURIComponent(community.id)}`
      );
      const uploadedPhotos = (result.items || []).map((item) => ({
        ...item,
        previewUrl: /^https?:\/\//.test(item.url)
          ? item.url
          : `${config.apiBaseUrl}${item.url}`
      }));
      this.setData({ uploadedPhotos, uploadedCount: uploadedPhotos.length });
    } catch (error) {
      this.setData({ uploadedPhotos: [], uploadedCount: 0 });
    }
  },

  previewUploadedPhoto(event) {
    const current = this.data.uploadedPhotos[event.currentTarget.dataset.index]?.previewUrl;
    if (!current) return;
    wx.previewImage({
      current,
      urls: this.data.uploadedPhotos.map((item) => item.previewUrl)
    });
  },

  async loadBuildings(preferredBuildingId = '') {
    const community = this.data.communities[this.data.communityIndex];
    if (!community) return;
    try {
      wx.showNavigationBarLoading();
      const result = await api.get(
        `/api/field/projects/${community.projectId}/communities/${community.id}/buildings`
      );
      const buildings = result.items || [];
      const buildingIndex = preferredBuildingId
        ? buildings.findIndex((item) => item.id === preferredBuildingId)
        : -1;
      const selected = buildings[buildingIndex];
      this.setData({
        buildings,
        buildingIndex,
        householdCount: selected?.householdCount == null
          ? this.data.householdCount
          : String(selected.householdCount)
      });
    } catch (error) {
      wx.showToast({ title: error.message || '楼栋读取失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  onBuildingChange(event) {
    const buildingIndex = Number(event.detail.value);
    const building = this.data.buildings[buildingIndex];
    this.setData({
      buildingIndex,
      householdCount: building?.householdCount == null ? '' : String(building.householdCount)
    });
    this.persistDraft();
  },

  onHouseholdInput(event) {
    this.setData({ householdCount: event.detail.value.replace(/[^\d]/g, '') });
    this.persistDraft();
  },

  onProblemGroupChange(event) {
    const problemGroupIndex = Number(event.detail.value);
    const problemItems = this.data.problemGroups[problemGroupIndex]?.items || [];
    this.setData({ problemGroupIndex, problemItems, problemIndex: -1 });
    this.updateActivePhotoProblem('');
    this.persistDraft();
  },

  onProblemChange(event) {
    const problemIndex = Number(event.detail.value);
    this.setData({ problemIndex });
    this.updateActivePhotoProblem(this.data.problemItems[problemIndex]?.code || '');
    this.persistDraft();
  },

  updateActivePhotoProblem(problemCode) {
    const index = this.data.activePhotoIndex;
    if (index < 0) return;
    const photos = [...this.data.photos];
    photos[index] = { ...photos[index], problemCode };
    this.setData({ photos });
  },

  applyActivePhotoProblem() {
    const photo = this.data.photos[this.data.activePhotoIndex];
    const problemCode = photo?.problemCode || '';
    const problemGroupIndex = this.data.problemGroups.findIndex((group) =>
      (group.items || []).some((item) => item.code === problemCode)
    );
    if (problemGroupIndex < 0) {
      this.setData({ problemGroupIndex: -1, problemItems: [], problemIndex: -1 });
      return;
    }
    const problemItems = this.data.problemGroups[problemGroupIndex].items || [];
    const problemIndex = problemItems.findIndex((item) => item.code === problemCode);
    this.setData({ problemGroupIndex, problemItems, problemIndex });
  },

  async choosePhotos() {
    const validationMessage = this.validateCaptureContext();
    if (validationMessage) {
      wx.showToast({ title: validationMessage, icon: 'none' });
      return;
    }
    if (this.data.photos.length) {
      wx.showToast({ title: '请先上传或删除当前照片', icon: 'none' });
      return;
    }
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        sizeType: ['compressed']
      });
      wx.showLoading({ title: '正在保存照片' });
      const file = result.tempFiles?.[0];
      if (!file) return;
      const project = this.data.projects[this.data.projectIndex];
      const community = this.data.communities[this.data.communityIndex];
      const building = this.data.buildings[this.data.buildingIndex];
      const compressedPath = await compressImage(file.tempFilePath);
      const savedPath = await saveFile(compressedPath);
      const photo = {
        path: savedPath,
        status: 'pending',
        clientTaskId: createClientTaskId(),
        capturedAt: new Date().toISOString(),
        projectId: String(project.id),
        projectName: project.name,
        communityId: community.id,
        communityName: community.name,
        buildingId: building?.id || '',
        buildingName: building?.name || '',
        householdCount: this.data.householdCount ? Number(this.data.householdCount) : null,
        problemCode: ''
      };
      this.setData({
        photos: [photo],
        activePhotoIndex: 0,
        problemGroupIndex: -1,
        problemItems: [],
        problemIndex: -1,
        lastError: ''
      });
      this.persistDraft();
    } catch (error) {
      if (!String(error.errMsg || '').includes('cancel')) {
        wx.showToast({ title: '照片保存失败', icon: 'none' });
      }
    } finally {
      wx.hideLoading();
    }
  },

  previewPhoto(event) {
    const current = this.data.photos[event.currentTarget.dataset.index]?.path;
    if (!current) return;
    wx.previewImage({
      current,
      urls: this.data.photos.map((item) => item.path)
    });
  },

  removePhoto(event) {
    if (this.data.uploading) return;
    const index = Number(event.currentTarget.dataset.index);
    const photos = [...this.data.photos];
    const [removed] = photos.splice(index, 1);
    removeSavedFile(removed?.path);
    this.setData({
      photos,
      activePhotoIndex: -1,
      problemGroupIndex: -1,
      problemItems: [],
      problemIndex: -1,
      lastError: ''
    });
    this.persistDraft();
  },

  validateCaptureContext() {
    if (this.data.projectIndex < 0) return '请先选择项目';
    if (this.data.communityIndex < 0) return '请选择小区';
    if (this.data.householdCount && !/^[1-9]\d*$/.test(this.data.householdCount)) {
      return '请输入正确的楼栋户数';
    }
    return '';
  },

  async uploadCurrentPhoto() {
    const photoIndex = this.data.activePhotoIndex;
    const photo = this.data.photos[photoIndex];
    if (!photo) {
      wx.showToast({ title: '请先拍摄一张照片', icon: 'none' });
      return;
    }
    const problem = this.data.problemItems[this.data.problemIndex];
    const collectorId = getApp().globalData.collectorId;
    const problemCode = problem?.code || '';
    const photosBeforeUpload = [...this.data.photos];
    photosBeforeUpload[photoIndex] = {
      ...photo,
      problemCode,
      status: 'uploading'
    };
    this.setData({ photos: photosBeforeUpload });
    this.persistDraft();
    this.setData({
      uploading: true,
      uploadProgress: 2,
      uploadMessage: '正在创建采集任务',
      lastError: ''
    });

    try {
      const taskResult = await api.post('/api/field/collection-tasks', {
        clientTaskId: photo.clientTaskId,
        projectId: photo.projectId,
        communityId: photo.communityId,
        buildingId: photo.buildingId,
        householdCount: photo.householdCount,
        problemCode,
        photoCount: 1,
        collectorId,
        capturedAt: photo.capturedAt
      });
      const task = taskResult.item;
      this.setData({ uploadProgress: 35, uploadMessage: '正在上传这张照片' });
      const [base64, info] = await Promise.all([
        readBase64(photo.path),
        imageInfo(photo.path)
      ]);
      const extension = info.type === 'png' ? 'png' : info.type === 'webp' ? 'webp' : 'jpeg';
      await api.post('/api/photos/upload', {
        photoId: `PHOTO-${task.id}-1`,
        taskId: task.id,
        projectId: photo.projectId,
        communityId: photo.communityId,
        buildingId: photo.buildingId,
        householdCount: photo.householdCount,
        problemCode,
        collectorId,
        imageIndex: 1,
        name: `${photo.communityName}-${photo.buildingName || '未选楼栋'}-${problem?.name || '现场照片'}.jpg`,
        description: problem?.name ? `微信小程序现场采集：${problem.name}` : '微信小程序现场采集',
        capturedAt: photo.capturedAt,
        width: info.width || 0,
        height: info.height || 0,
        dataUrl: `data:image/${extension};base64,${base64}`
      }, 60000);

      await api.post(`/api/field/collection-tasks/${task.id}/complete`, {
        uploadedPhotoCount: 1
      });
      this.setData({ uploadProgress: 100, uploadMessage: '上传完成' });
      removeSavedFile(photo.path);
      this.setData({
        photos: [],
        activePhotoIndex: -1,
        problemGroupIndex: -1,
        problemItems: [],
        problemIndex: -1,
        lastError: ''
      });
      await this.loadUploadedPhotos();
      this.persistDraft();
      wx.showToast({ title: '本张照片已上传', icon: 'success' });
    } catch (error) {
      const retryPhotos = [...this.data.photos];
      if (retryPhotos[photoIndex]) retryPhotos[photoIndex].status = 'pending';
      this.setData({
        photos: retryPhotos,
        lastError: `${error.message || '上传失败'}。照片已保存在本机，可退出后继续重试。`
      });
      this.persistDraft();
    } finally {
      this.setData({ uploading: false });
    }
  }
});
