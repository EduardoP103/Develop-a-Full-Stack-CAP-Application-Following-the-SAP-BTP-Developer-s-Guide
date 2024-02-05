const cds = require('@sap/cds/lib');
const axios = require('axios');
const { SELECT } = cds.test(__dirname + '../../');
const { expect } = require('chai');

axios.defaults.auth = { username: 'incident.support@tester.sap.com', password: 'initial' };

jest.setTimeout(11111);

describe('Test The GET Endpoints', () => {
  it('Should check Processor Service', async () => {
    const processorService = await cds.connect.to('ProcessorService');
    const { Incidents } = processorService.entities;
    const result = await SELECT.from(Incidents);
    expect(result).to.have.length(4);
  });

  it('Should check Customers', async () => {
    const processorService = await cds.connect.to('ProcessorService');
    const { Customers } = processorService.entities;
    const result = await SELECT.from(Customers);
    expect(result).to.have.length(3);
  });

  it('Test Expand Entity Endpoint', async () => {
    const { data } = await axios.get('/odata/v4/processor/Customers?$select=firstName&$expand=incidents');
    expect(data).to.be.an('object');
  });
});

describe('Draft Choreography APIs', () => {
  let draftId, incidentId;

  it('Create an incident', async () => {
    const { status, statusText, data } = await axios.post('/odata/v4/processor/Incidents', {
      title: 'Urgent attention required !',
      status_code: 'N'
    });
    draftId = data.ID;
    expect(status).to.equal(201);
    expect(statusText).to.equal('Created');
  });

  it('+ Activate the draft & check Urgency code as H using custom logic', async () => {
    const response = await axios.post(
      `/odata/v4/processor/Incidents(ID=${draftId},IsActiveEntity=false)/ProcessorService.draftActivate`
    );
    expect(response.status).to.eql(201);
    expect(response.data.urgency_code).to.eql('H');
  });

  it('+ Test the incident status', async () => {
    const { status, data: { status_code, ID } } = await axios.get(`/odata/v4/processor/Incidents(ID=${draftId},IsActiveEntity=true)`);
    incidentId = ID;
    expect(status).to.eql(200);
    expect(status_code).to.eql('N');
  });

  describe('Close Incident and Open it again to check Custom logic', () => {
    it(`Should Close the Incident-${incidentId}`, async () => {
      const { status } = await axios.post(
        `/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=true)/ProcessorService.draftEdit`,
        {
          PreserveChanges: true
        }
      );
      expect(status).to.equal(201);
    });

    it(`Should Close the Incident-${incidentId}`, async () => {
      const { status } = await axios.patch(`/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=false)`, {
        status_code: 'C'
      });
      expect(status).to.equal(200);
    });

    it('+ Activate the draft & check Status code as C using custom logic', async () => {
      const response = await axios.post(
        `/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=false)/ProcessorService.draftActivate`
      );
      expect(response.status).to.eql(200);
    });

    it('+ Test the incident status to be closed', async () => {
      const { status, data: { status_code } } = await axios.get(`/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=true)`);
      expect(status).to.eql(200);
      expect(status_code).to.eql('C');
    });

    describe('should fail to re-open closed incident', () => {
      it(`Should Open Closed Incident-${incidentId}`, async () => {
        const { status } = await axios.post(
          `/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=true)/ProcessorService.draftEdit`,
          {
            PreserveChanges: true
          }
        );
        expect(status).to.equal(201);
      });

      it(`Should re-open the Incident-${incidentId} but fail`, async () => {
        const { status } = await axios.patch(`/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=false)`, {
          status_code: 'N'
        });
        expect(status).to.equal(200);
      });

      it('Should fail to activate draft trying to re-open the incident', async () => {
        try {
          await axios.post(
            `/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=false)/ProcessorService.draftActivate`
          );
        } catch (error) {
          expect(error.response.status).to.eql(500);
          expect(error.response.data.error.message).to.include(`Can't modify a closed incident`);
        }
      });
    });
  });

  it('- Delete the Draft', async () => {
    const response = await axios.delete(`/odata/v4/processor/Incidents(ID=${draftId},IsActiveEntity=false)`);
    expect(response.status).to.eql(204);
  });

  it('- Delete the Incident', async () => {
    const response = await axios.delete(`/odata/v4/processor/Incidents(ID=${incidentId},IsActiveEntity=true)`);
    expect(response.status).to.eql(204);
  });
});
