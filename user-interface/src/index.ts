import {PDFDocument, PDFTextField, PDFCheckBox} from 'pdf-lib';

export async function fileHandler(PDFInput:  ArrayBuffer) : Promise<Map<string, string | boolean | undefined>> {
    const charInfo = new Map<string, string | boolean | undefined>();

    const charSheet = await PDFDocument.load(PDFInput);
    const form = charSheet.getForm()

    const fields = form.getFields()
    fields.forEach(field => {
        let value = undefined;
        const name = field.getName()

        if (field instanceof PDFTextField){
            value = (field.getText())
        }
        else if (field instanceof PDFCheckBox){
            value = (field.isChecked())
        }
        charInfo.set(name, value)
    })
    return charInfo;
}

