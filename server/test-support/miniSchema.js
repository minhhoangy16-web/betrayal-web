// Bộ kiểm tra JSON Schema tối giản (đủ cho các schema trong shared/schemas) để test không cần
// cài thêm thư viện. Hỗ trợ: type, enum, const, properties, required, additionalProperties,
// items, minItems, maxItems, minimum, maximum, anyOf, $ref nội bộ (#/$defs/...).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadSchema(name) {
  const url = new URL(`../../shared/schemas/${name}.schema.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
};

const matchesType = (v, t) => typeOf(v) === t || (t === 'number' && typeOf(v) === 'integer');

// Trả về mảng thông báo lỗi (rỗng = hợp lệ).
export function validate(schema, value, root = schema, path = '$') {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((node, key) => node?.[key], root);
    if (!target) return [`${path}: không tìm thấy ${schema.$ref}`];
    return validate(target, value, root, path);
  }
  const errors = [];
  if (schema.anyOf) {
    const ok = schema.anyOf.some((sub) => validate(sub, value, root, path).length === 0);
    if (!ok) {
      const detail = schema.anyOf.map((sub) => validate(sub, value, root, path)[0]).join(' | ');
      errors.push(`${path}: không khớp nhánh anyOf nào (${detail})`);
    }
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      return [...errors, `${path}: cần kiểu ${types.join('|')}, nhận ${typeOf(value)}`];
    }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} không nằm trong enum`);
  if ('const' in schema && schema.const !== value) errors.push(`${path}: phải bằng ${JSON.stringify(schema.const)}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: nhỏ hơn ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: lớn hơn ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: ít hơn ${schema.minItems} phần tử`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: nhiều hơn ${schema.maxItems} phần tử`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, root, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: thiếu trường "${key}"`);
    }
    for (const [key, v] of Object.entries(value)) {
      if (props[key]) errors.push(...validate(props[key], v, root, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: trường thừa "${key}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validate(schema.additionalProperties, v, root, `${path}.${key}`));
      }
    }
  }
  return errors;
}
