jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' }, requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(), getPendingResultAsync: jest.fn() }));
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { pickScenarioImage, recoverScenarioImage } from '../src/services/scenarioImagePicker';

describe('Scenario photo picking', () => {
  beforeEach(() => { jest.resetAllMocks(); (Platform as any).OS = 'ios'; });
  it('denied camera permission leaves the draft to the caller without launching the camera', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expect(pickScenarioImage('camera')).rejects.toThrow('Camera access');
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
  it('cancelled gallery picking returns no replacement scenario', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    expect(await pickScenarioImage('library')).toBeNull();
  });
  it('requests only a still image and returns SDK51 native JPEG bytes', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ base64: '/9j/data', mimeType: 'image/heic', uri: 'file:///picked' }] });
    expect(await pickScenarioImage('camera')).toEqual({ base64: '/9j/data', mimeType: 'image/jpeg', uri: 'file:///picked' });
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: true, allowsEditing: false, mediaTypes: 'Images' }));
  });
  it('unreadable image reports an actionable error without inventing image data', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///broken' }] });
    await expect(pickScenarioImage('library')).rejects.toThrow('could not be read');
  });
  it('recovers the SDK51 array result after Android activity recreation', async () => {
    (Platform as any).OS = 'android';
    (ImagePicker.getPendingResultAsync as jest.Mock).mockResolvedValue([{ canceled: false, assets: [{ base64: '/9j/recovered', uri: 'file:///recovered' }] }]);
    expect(await recoverScenarioImage()).toEqual({ base64: '/9j/recovered', mimeType: 'image/jpeg', uri: 'file:///recovered' });
  });
  it('reports a failed recovered picker result rather than treating it as image content', async () => {
    (Platform as any).OS = 'android';
    (ImagePicker.getPendingResultAsync as jest.Mock).mockResolvedValue([{ code: 'camera_error', message: 'lost' }]);
    await expect(recoverScenarioImage()).rejects.toThrow('could not be recovered');
  });
});
