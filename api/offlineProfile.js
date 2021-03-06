const { UserInputError } = require('apollo-server-express');
const { getDb, getNextSequence } = require('./db.js');
const { mustBeSignedIn } = require('./auth.js');

async function get(_, { id }) {
  const db = getDb();
  const offlineProfile = await db.collection('offlineProfiles').findOne({ id });
  return offlineProfile;
}

async function list() {
  const db = getDb();
  const offlineProfiles = await db.collection('offlineProfiles').find({}).toArray();
  return offlineProfiles;
}

const PAGE_SIZE = 10;

async function list(_, {
  status, storageMin, storageMax, search, page, userId,
}) {
  const db = getDb();
  const filter = {};
  if (userId) filter.userId = userId;

  if (status) filter.status = status;

  if (storageMin !== undefined || storageMax !== undefined) {
    filter.storage = {};
    if (storageMin !== undefined) filter.storage.$gte = storageMin;
    if (storageMax !== undefined) filter.storage.$lte = storageMax;
  }

  if (search) filter.$text = { $search: search };

  const cursor = db.collection('offlineProfiles').find(filter)
    .sort({ id: 1 })
    .skip(PAGE_SIZE * (page - 1))
    .limit(PAGE_SIZE);

  const totalCount = await cursor.count(false);
  const offlineProfiles = cursor.toArray();
  const pages = Math.ceil(totalCount / PAGE_SIZE);
  return { offlineProfiles, pages };
}

function validateAdd(offlineProfile) {
  const errors = [];
  if (!offlineProfile.name || !offlineProfile.seeking) {
    errors.push('All fields are mandatory. Please fill in all fields');
  }
  if (errors.length > 0) {
    throw new UserInputError('Invalid input(s)', { errors });
  }
}

function validateUpdate(offlineProfile) {
  const errors = [];
  if (!offlineProfile.name || !offlineProfile.seeking || !offlineProfile.address || !offlineProfile.postal || !offlineProfile.product || !offlineProfile.website || !offlineProfile.totalStorage || !offlineProfile.totalColdStorage) {
    errors.push('All fields are mandatory. Please fill in all fields');
  }
  if (errors.length > 0) {
    throw new UserInputError('Invalid input(s)', { errors });
  }
}

async function add(_, { offlineProfile }) {
  const db = getDb();
  validateAdd(offlineProfile);

  const newOfflineProfile = Object.assign({}, offlineProfile);
  newOfflineProfile.created = new Date();
  newOfflineProfile.id = await getNextSequence('offlineProfiles');
  newOfflineProfile.reserved = false
  // newOfflineProfile.totalStorage = availStorage
  // newOfflineProfile.totalColdStorage = availColdStorage

  const result = await db.collection('offlineProfiles').insertOne(newOfflineProfile);
  const savedOfflineProfile = await db.collection('offlineProfiles')
    .findOne({ _id: result.insertedId });
  // console.log('add - savedOfflineProfile:', savedOfflineProfile);
  return savedOfflineProfile;
}

async function update(_, { id, changes }) {
  const db = getDb();
  // console.log('update - changes:', changes);
  if (changes.name || changes.seeking || changes.product || changes.website || changes.address || changes.postal || changes.availStorage || changes.availColdStorage || changes.totalStorage || changes.totalColdStorage) {
    // changes.availStorage = changes.totalStorage
    // changes.availColdStorage = changes.totalColdStorage
    const offlineProfile = await db.collection('offlineProfiles').findOne({ id });
    // console.log('update - offlineProfile db object:', offlineProfile);

    Object.assign(offlineProfile, changes);
    validateUpdate(offlineProfile);
  }
  await db.collection('offlineProfiles').updateOne({ id }, { $set: changes });
  const savedOfflineProfile = await db.collection('offlineProfiles').findOne({ id });
  // console.log('update - savedOfflineProfile:', savedOfflineProfile);
  return savedOfflineProfile;
}

module.exports = {
  list,
  add: mustBeSignedIn(add),
  get,
  update: mustBeSignedIn(update),
};
