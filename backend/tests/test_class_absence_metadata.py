import base64
from io import BytesIO
from PIL import Image
from backend.tests.test_absence_kinds import AbsenceKindsTest, DAY


class ClassAbsenceMetadataTest(AbsenceKindsTest):
    def test_class_metadata_round_trip_and_deletion(self):
        image = BytesIO()
        Image.new('RGB', (1, 1)).save(image, format='PNG')
        payload = dict(group='cf', id='1A', note='Gita', classification='trip', attachment=dict(mediaType='image/png', data=base64.b64encode(image.getvalue()).decode()))
        self.entry(**payload).raise_for_status()
        self.entry(group='cf', id='1A', hours=[1]).raise_for_status()
        state = self.state()
        self.assertEqual(state['classAbsenceNotes'][DAY]['1A'], 'Gita')
        self.assertEqual(state['classAbsenceKinds'][DAY]['1A'], 'trip')
        self.assertIn('1A', state['classAbsenceAttachments'][DAY])
        self.client.post('/api/import', json=state).raise_for_status()
        self.assertEqual(self.state()['classAbsenceNotes'][DAY]['1A'], 'Gita')
        self.entry(group='cf', id='1A', hours=None).raise_for_status()
        for key in ('classAbsenceNotes', 'classAbsenceKinds', 'classAbsenceAttachments'):
            self.assertNotIn('1A', self.state()[key][DAY])
