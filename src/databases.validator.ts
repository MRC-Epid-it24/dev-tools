/* tslint:disable */
// generated by typescript-json-validator
import {inspect} from 'util';
import Ajv = require('ajv');
import {DatabaseProfiles} from './databases';
export const ajv = new Ajv({"allErrors":true,"coerceTypes":false,"format":"fast","nullable":true,"unicode":true,"uniqueItems":true,"useDefaults":true});

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

export {DatabaseProfiles};
export const DatabaseProfilesSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "additionalProperties": {
    "$ref": "#/definitions/DatabaseProfile"
  },
  "defaultProperties": [
  ],
  "definitions": {
    "DatabaseConnectionParameters": {
      "defaultProperties": [
      ],
      "properties": {
        "host": {
          "type": "string"
        },
        "password": {
          "type": "string"
        },
        "port": {
          "type": "number"
        },
        "user": {
          "type": "string"
        }
      },
      "required": [
        "host",
        "user"
      ],
      "type": "object"
    },
    "DatabaseProfile": {
      "defaultProperties": [
      ],
      "properties": {
        "foods": {
          "$ref": "#/definitions/DatabaseConnectionParameters"
        },
        "system": {
          "$ref": "#/definitions/DatabaseConnectionParameters"
        }
      },
      "required": [
        "foods",
        "system"
      ],
      "type": "object"
    }
  },
  "type": "object"
};
export type ValidateFunction<T> = ((data: unknown) => data is T) & Pick<Ajv.ValidateFunction, 'errors'>
export const isDatabaseProfiles = ajv.compile(DatabaseProfilesSchema) as ValidateFunction<DatabaseProfiles>;
export default function validate(value: unknown): DatabaseProfiles {
  if (isDatabaseProfiles(value)) {
    return value;
  } else {
    throw new Error(
      ajv.errorsText(isDatabaseProfiles.errors!.filter((e: any) => e.keyword !== 'if'), {dataVar: 'DatabaseProfiles'}) +
      '\n\n' +
      inspect(value),
    );
  }
}