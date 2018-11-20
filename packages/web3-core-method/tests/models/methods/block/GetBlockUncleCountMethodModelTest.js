import * as sinonLib from 'sinon';
import utils from 'web3-utils';
import {formatters} from 'web3-core-helpers';
import GetBlockUncleCountMethodModel from '../../../../src/models/methods/block/GetBlockUncleCountMethodModel';

const sinon = sinonLib.createSandbox();

/**
 * GetBlockUncleCountMethodModel test
 */
describe('GetBlockUncleCountMethodModelTest', () => {
    let model, utilsMock, formattersMock;

    beforeEach(() => {
        utilsMock = sinon.mock(utils);
        formattersMock = sinon.mock(formatters);

        model = new GetBlockUncleCountMethodModel(utils, formatters);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('rpcMethod should return eth_getUncleCountByBlockNumber', () => {
        expect(model.rpcMethod).to.equal('eth_getUncleCountByBlockNumber');
    });

    it('parametersAmount should return 1', () => {
        expect(model.parametersAmount).to.equal(1);
    });

    it('should call beforeExecution with block hash as parameter and call inputBlockNumberFormatter', () => {
        model.parameters = ['0x0'];

        formattersMock
            .expects('inputBlockNumberFormatter')
            .withArgs(model.parameters[0])
            .returns('0x0')
            .once();

        model.beforeExecution({});

        expect(model.parameters[0]).equal('0x0');

        formattersMock.verify();

        expect(model.rpcMethod).equal('eth_getUncleCountByBlockHash');
    });

    it('should call beforeExecution with block number as parameter and call inputBlockNumberFormatter', () => {
        model.parameters = [100];

        formattersMock
            .expects('inputBlockNumberFormatter')
            .withArgs(model.parameters[0])
            .returns('0x0')
            .once();

        model.beforeExecution({});

        expect(model.parameters[0]).equal('0x0');

        formattersMock.verify();

        expect(model.rpcMethod).equal('eth_getUncleCountByBlockNumber');
    });

    it('afterExecution should map the hex string to a number', () => {
        utilsMock
            .expects('hexToNumber')
            .withArgs('0x0')
            .returns(100)
            .once();

        expect(model.afterExecution('0x0')).equal(100);

        utilsMock.verify();
    });
});